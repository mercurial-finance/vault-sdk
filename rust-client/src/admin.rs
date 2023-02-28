use anchor_client::solana_sdk::signature::Keypair;
use anchor_client::solana_sdk::signer::Signer;
use anchor_client::solana_sdk::{system_instruction, system_program, sysvar};
use anchor_client::Program;
use anchor_lang::prelude::Pubkey;
use anchor_spl::token::Mint;
use anyhow::Result;

use crate::user::get_or_create_ata;

fn create_mint(
    program_client: &Program,
    mint_keypair: &Keypair,
    authority: Pubkey,
    decimals: u8,
) -> Result<()> {
    let rpc = program_client.rpc();

    let token_mint_account_rent =
        rpc.get_minimum_balance_for_rent_exemption(anchor_spl::token::Mint::LEN)?;

    let instructions = vec![
        system_instruction::create_account(
            &program_client.payer(),
            &mint_keypair.pubkey(),
            token_mint_account_rent,
            anchor_spl::token::Mint::LEN as u64,
            &anchor_spl::token::ID,
        ),
        anchor_spl::token::spl_token::instruction::initialize_mint(
            &anchor_spl::token::ID,
            &mint_keypair.pubkey(),
            &authority,
            None,
            decimals,
        )
        .unwrap(),
    ];

    let builder = program_client.request();
    let builder = builder.signer(mint_keypair);
    let builder = instructions
        .into_iter()
        .fold(builder, |bld, ix| bld.instruction(ix));
    let signature = builder.send()?;

    println!("{}", signature);

    Ok(())
}

pub fn initialize_vault(
    program_client: &Program,
    token_mint: Pubkey,
    admin: Pubkey,
    base_key: Keypair,
) -> Result<()> {
    println!("initialize vault");

    let (vault, _vault_bump) = Pubkey::find_program_address(
        &[
            b"vault".as_ref(),
            token_mint.as_ref(),
            base_key.pubkey().as_ref(),
        ],
        &program_client.id(),
    );

    let (token_vault, _token_vault_bump) = Pubkey::find_program_address(
        &[b"token_vault".as_ref(), vault.as_ref()],
        &program_client.id(),
    );

    let token_mint_state: Mint = program_client.account(token_mint)?;

    let lp_mint_keypair = Keypair::new();

    create_mint(
        program_client,
        &lp_mint_keypair,
        vault,
        token_mint_state.decimals,
    )?;

    let lp_mint = lp_mint_keypair.pubkey();

    let fee_vault = get_or_create_ata(
        program_client,
        lp_mint,
        mercurial_vault::get_treasury_address(),
    )?;

    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::Initialize {
            base: base_key.pubkey(),
            vault,
            admin,
            token_vault,
            fee_vault,
            token_mint,
            lp_mint,
            system_program: system_program::id(),
            rent: sysvar::rent::ID,
            token_program: anchor_spl::token::ID,
        })
        .args(mercurial_vault::instruction::Initialize {})
        .signer(&base_key);

    let signature = builder.send()?;
    println!("{}", signature);

    Ok(())
}
