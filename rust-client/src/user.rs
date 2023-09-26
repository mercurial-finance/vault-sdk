use anchor_client::solana_sdk::signature::Signer;
use anchor_client::solana_sdk::signer::keypair::Keypair;
use anchor_client::solana_sdk::system_instruction;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_spl::token::spl_token;
use anyhow::Result;
use std::ops::Deref;

pub fn deposit<C: Deref<Target = impl Signer> + Clone>(
    program_client: &anchor_client::Program<C>,
    token_mint: Pubkey,
    base: Pubkey,
    token_amount: u64,
) -> Result<()> {
    println!("deposit {}", token_amount);

    let (vault, _vault_bump) = mercurial_vault::utils::derive_vault_address(token_mint, base);

    let (token_vault, _token_vault_bump) =
        mercurial_vault::utils::derive_token_vault_address(vault);

    let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
    let lp_mint = vault_state.lp_mint;

    let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
    let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;

    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault,
            token_vault,
            lp_mint,
            user_token,
            user_lp,
            user: program_client.payer(),
            token_program: spl_token::id(),
        })
        .args(mercurial_vault::instruction::Deposit {
            token_amount,
            minimum_lp_token_amount: 0,
        });

    let signature = builder.send()?;
    println!("{}", signature);

    Ok(())
}

pub fn withdraw<C: Deref<Target = impl Signer> + Clone>(
    program_client: &anchor_client::Program<C>,
    token_mint: Pubkey,
    base: Pubkey,
    unmint_amount: u64,
) -> Result<()> {
    println!("withdraw {} lp token", unmint_amount);

    let (vault, _vault_bump) = mercurial_vault::utils::derive_vault_address(token_mint, base);

    let (token_vault, _token_vault_bump) =
        mercurial_vault::utils::derive_token_vault_address(vault);

    let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
    let lp_mint = vault_state.lp_mint;

    let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
    let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;

    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault,
            token_vault,
            lp_mint,
            user_token,
            user_lp,
            user: program_client.payer(),
            token_program: spl_token::id(),
        })
        .args(mercurial_vault::instruction::Withdraw {
            unmint_amount,
            min_out_amount: 0,
        });

    let signature = builder.send()?;
    println!("{}", signature);

    Ok(())
}

pub fn get_or_create_ata<C: Deref<Target = impl Signer> + Clone>(
    program_client: &anchor_client::Program<C>,
    token_mint: Pubkey,
    user: Pubkey,
) -> Result<Pubkey> {
    let user_token_account =
        spl_associated_token_account::get_associated_token_address(&user, &token_mint);
    let rpc_client = program_client.rpc();
    if rpc_client.get_account_data(&user_token_account).is_err() {
        println!("Create ATA for TOKEN {} \n", &token_mint);

        let builder = program_client.request().instruction(
            spl_associated_token_account::create_associated_token_account(
                &program_client.payer(),
                &user,
                &token_mint,
            ),
        );

        let signature = builder.send()?;
        println!("{}", signature);
    }
    Ok(user_token_account)
}

pub fn create_mint<C: Deref<Target = impl Signer> + Clone>(
    program_client: &anchor_client::Program<C>,
    mint_keypair: &Keypair,
    authority: Pubkey,
    decimals: u8,
) -> Result<()> {
    let rpc = program_client.rpc();

    let token_mint_account_rent =
        rpc.get_minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN)?;

    let instructions = vec![
        system_instruction::create_account(
            &program_client.payer(),
            &mint_keypair.pubkey(),
            token_mint_account_rent,
            spl_token::state::Mint::LEN as u64,
            &spl_token::id(),
        ),
        spl_token::instruction::initialize_mint(
            &spl_token::id(),
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
