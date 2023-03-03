use assert_matches::assert_matches;

use anchor_lang::solana_program::{
    instruction::Instruction, program_pack::Pack, pubkey::Pubkey, system_instruction,
};
use anchor_lang::AccountDeserialize;
use anchor_spl::token::{spl_token, Token};
use solana_program_test::{BanksClient, ProgramTest};
use solana_sdk::{
    account::Account,
    signature::{Keypair, Signer},
    transaction::Transaction,
};

pub async fn initialize_mint(
    payer: &Keypair,
    token_mint: &Keypair,
    authority: &Pubkey,
    decimals: u8,
    banks_client: &mut BanksClient,
) {
    let rent = banks_client.get_rent().await.unwrap();
    let token_mint_account_rent = rent.minimum_balance(spl_token::state::Mint::LEN);
    let recent_blockhash = banks_client.get_latest_blockhash().await.unwrap();
    let transaction = Transaction::new_signed_with_payer(
        &[
            system_instruction::create_account(
                &payer.pubkey(),
                &token_mint.pubkey(),
                token_mint_account_rent,
                spl_token::state::Mint::LEN as u64,
                &spl_token::id(),
            ),
            spl_token::instruction::initialize_mint(
                &spl_token::id(),
                &token_mint.pubkey(),
                authority,
                None,
                decimals,
            )
            .unwrap(),
        ],
        Some(&payer.pubkey()),
        &[payer, token_mint],
        recent_blockhash,
    );

    assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
}

pub async fn mint_to(
    payer: &Keypair,
    token_mint_pubkey: &Pubkey,
    token_pubkey: &Pubkey,
    amount: u64,
    banks_client: &mut BanksClient,
) {
    let recent_blockhash = banks_client.get_latest_blockhash().await.unwrap();
    let transaction = Transaction::new_signed_with_payer(
        &[spl_token::instruction::mint_to(
            &spl_token::id(),
            token_mint_pubkey,
            token_pubkey,
            &payer.pubkey(),
            &[],
            amount,
        )
        .unwrap()],
        Some(&payer.pubkey()),
        &[payer],
        recent_blockhash,
    );

    assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
}

pub async fn create_associated_token_account(
    payer: &Keypair,
    token_mint: &Pubkey,
    authority: &Pubkey,
    banks_client: &mut BanksClient,
) {
    let ins = vec![
        spl_associated_token_account::instruction::create_associated_token_account(
            &payer.pubkey(),
            &authority,
            &token_mint,
            &spl_token::id(),
        ),
    ];

    process_and_assert_ok(&ins, payer, &[payer], banks_client).await;
}

pub async fn process_and_assert_ok(
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
    banks_client: &mut BanksClient,
) {
    let recent_blockhash = banks_client.get_latest_blockhash().await.unwrap();

    let mut all_signers = vec![payer];
    all_signers.extend_from_slice(signers);

    let tx = Transaction::new_signed_with_payer(
        &instructions,
        Some(&payer.pubkey()),
        &all_signers,
        recent_blockhash,
    );

    assert_matches!(banks_client.process_transaction(tx).await, Ok(()));
}

pub async fn process_and_assert_err(
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
    banks_client: &mut BanksClient,
) {
    let recent_blockhash = banks_client.get_latest_blockhash().await.unwrap();

    let mut all_signers = vec![payer];
    all_signers.extend_from_slice(signers);

    let tx = Transaction::new_signed_with_payer(
        &instructions,
        Some(&payer.pubkey()),
        &all_signers,
        recent_blockhash,
    );
    match banks_client.process_transaction(tx).await {
        Ok(()) => panic!(),
        _ => {}
    }
}

pub async fn get_mint_account(
    mint_account_address: &Pubkey,
    banks_client: &mut BanksClient,
) -> spl_token::state::Mint {
    spl_token::state::Mint::unpack_from_slice(
        &banks_client
            .get_account(*mint_account_address)
            .await
            .unwrap()
            .unwrap()
            .data,
    )
    .unwrap()
}

pub async fn get_token_account(
    token_account_address: &Pubkey,
    banks_client: &mut BanksClient,
) -> spl_token::state::Account {
    spl_token::state::Account::unpack_from_slice(
        &banks_client
            .get_account(*token_account_address)
            .await
            .unwrap()
            .unwrap()
            .data,
    )
    .unwrap()
}

pub async fn get_or_create_ata(
    token_mint: &Pubkey,
    user: &Pubkey,
    payer: &Keypair,
    banks_client: &mut BanksClient,
) -> Pubkey {
    let user_token_account =
        spl_associated_token_account::get_associated_token_address(&user, &token_mint);
    let user_token_account_state = &banks_client.get_account(user_token_account).await.unwrap();
    if user_token_account_state.is_none() {
        create_associated_token_account(payer, token_mint, user, banks_client).await;
    }
    user_token_account
}
