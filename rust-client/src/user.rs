use crate::strategy_handler::base::get_strategy_handler;
use anchor_lang::ToAccountMetas;
use anyhow::Result;
use solana_program::program_pack::Pack;
use solana_program::pubkey::Pubkey;
use solana_sdk::signature::Signer;
use solana_sdk::signer::keypair::Keypair;
use solana_sdk::system_instruction;
use spl_associated_token_account;

pub fn deposit(
    program_client: &anchor_client::Program,
    token_mint: Pubkey,
    base: Pubkey,
    token_amount: u64,
) -> Result<()> {
    println!("deposit {}", token_amount);

    let (vault, _vault_bump) = Pubkey::find_program_address(
        &[b"vault".as_ref(), token_mint.as_ref(), base.as_ref()],
        &program_client.id(),
    );

    let (token_vault, _token_vault_bump) = Pubkey::find_program_address(
        &[b"token_vault".as_ref(), vault.as_ref()],
        &program_client.id(),
    );

    let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
    let lp_mint = vault_state.lp_mint;

    let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
    let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;

    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault: vault,
            token_vault: token_vault,
            lp_mint: lp_mint,
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

pub fn withdraw2(
    program_client: &anchor_client::Program,
    token_mint: Pubkey,
    base: Pubkey,
    unmint_amount: u64,
    strategy: Option<Pubkey>,
) -> Result<()> {
    match strategy {
        Some(strategy) => withdraw2_from_vault_and_strategy(
            program_client,
            token_mint,
            base,
            unmint_amount,
            strategy,
        ),
        None => withdraw2_from_vault(program_client, token_mint, base, unmint_amount),
    }
}

pub fn withdraw2_from_vault_and_strategy(
    program_client: &anchor_client::Program,
    token_mint: Pubkey,
    base: Pubkey,
    unmint_amount: u64,
    strategy: Pubkey,
) -> Result<()> {
    let strategy_state: mercurial_vault::state::Strategy = program_client.account(strategy)?;
    let strategy_handler = get_strategy_handler(strategy_state.strategy_type);
    let mut remaining_accounts = strategy_handler.get_withdraw2_remaining_accounts(
        program_client,
        strategy,
        token_mint,
        base,
    )?;

    let (vault, _vault_bump) = Pubkey::find_program_address(
        &[b"vault".as_ref(), token_mint.as_ref(), base.as_ref()],
        &program_client.id(),
    );

    let (token_vault, _token_vault_bump) = Pubkey::find_program_address(
        &[b"token_vault".as_ref(), vault.as_ref()],
        &program_client.id(),
    );

    let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
    let lp_mint = vault_state.lp_mint;

    let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
    let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;

    let mut accounts = mercurial_vault::accounts::DepositWithdrawLiquidity {
        vault: vault,
        token_vault: token_vault,
        lp_mint: lp_mint,
        user_token,
        user_lp,
        user: program_client.payer(),
        token_program: spl_token::id(),
    }
    .to_account_metas(None);
    accounts.append(&mut remaining_accounts);

    let builder =
        program_client
            .request()
            .accounts(accounts)
            .args(mercurial_vault::instruction::Withdraw2 {
                unmint_amount,
                min_out_amount: 0,
            });

    let signature = builder.send()?;
    println!("{}", signature);

    Ok(())
}

pub fn withdraw2_from_vault(
    program_client: &anchor_client::Program,
    token_mint: Pubkey,
    base: Pubkey,
    unmint_amount: u64,
) -> Result<()> {
    println!("withdraw {} lp token", unmint_amount);

    let (vault, _vault_bump) = Pubkey::find_program_address(
        &[b"vault".as_ref(), token_mint.as_ref(), base.as_ref()],
        &program_client.id(),
    );

    let (token_vault, _token_vault_bump) = Pubkey::find_program_address(
        &[b"token_vault".as_ref(), vault.as_ref()],
        &program_client.id(),
    );

    let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
    let lp_mint = vault_state.lp_mint;

    let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
    let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;

    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault: vault,
            token_vault: token_vault,
            lp_mint: lp_mint,
            user_token,
            user_lp,
            user: program_client.payer(),
            token_program: spl_token::id(),
        })
        .args(mercurial_vault::instruction::Withdraw2 {
            unmint_amount,
            min_out_amount: 0,
        });

    let signature = builder.send()?;
    println!("{}", signature);

    Ok(())
}

pub fn withdraw(
    program_client: &anchor_client::Program,
    token_mint: Pubkey,
    base: Pubkey,
    unmint_amount: u64,
) -> Result<()> {
    println!("withdraw {} lp token", unmint_amount);

    let (vault, _vault_bump) = Pubkey::find_program_address(
        &[b"vault".as_ref(), token_mint.as_ref(), base.as_ref()],
        &program_client.id(),
    );

    let (token_vault, _token_vault_bump) = Pubkey::find_program_address(
        &[b"token_vault".as_ref(), vault.as_ref()],
        &program_client.id(),
    );

    let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
    let lp_mint = vault_state.lp_mint;

    let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
    let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;

    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault: vault,
            token_vault: token_vault,
            lp_mint: lp_mint,
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

pub fn get_or_create_ata(
    program_client: &anchor_client::Program,
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

pub fn create_mint(
    program_client: &anchor_client::Program,
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
