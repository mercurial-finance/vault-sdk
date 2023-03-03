use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::solana_program::{
    hash::Hash, instruction::Instruction, program_option::COption, pubkey::Pubkey, sysvar,
};
use anchor_lang::InstructionData;
use anchor_lang::ToAccountMetas;
use anchor_spl::token::spl_token;
use assert_matches::assert_matches;
use mercurial_vault::state::MAX_STRATEGY;
use solana_program_test::BanksClient;
use solana_sdk::{instruction::AccountMeta, signature::keypair_from_seed, system_instruction};
use solana_sdk::{
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};

use super::utils::*;

pub struct Vault {
    pub pubkey: Pubkey,
    pub token_vault: Pubkey,
    pub lp_mint: Pubkey,
}

pub async fn initialize_vault(
    token_mint: Pubkey,
    admin: &Keypair,
    banks_client: &mut BanksClient,
) -> Vault {
    let base = Keypair::new();
    let (vault, vault_bump) =
        mercurial_vault::utils::derive_vault_address(token_mint, base.pubkey());

    let (token_vault, token_vault_bump) = mercurial_vault::utils::derive_token_vault_address(vault);

    let token_mint_state = get_mint_account(&token_mint, banks_client).await;

    let lp_mint = Keypair::new();

    initialize_mint(
        admin,
        &lp_mint,
        &vault,
        token_mint_state.decimals,
        banks_client,
    )
    .await;

    // create fee vault as admin authority
    let fee_vault = spl_associated_token_account::get_associated_token_address(
        &mercurial_vault::get_treasury_address(),
        &lp_mint.pubkey(),
    );
    create_associated_token_account(
        admin,
        &lp_mint.pubkey(),
        &mercurial_vault::get_treasury_address(),
        banks_client,
    )
    .await;

    let init_vault_ins = Instruction {
        program_id: mercurial_vault::id(),
        accounts: mercurial_vault::accounts::Initialize {
            base: base.pubkey(),
            vault,
            admin: admin.pubkey(),
            token_vault,
            token_mint,
            fee_vault,
            lp_mint: lp_mint.pubkey(),
            system_program: system_program::id(),
            rent: sysvar::rent::ID,
            token_program: spl_token::id(),
        }
        .to_account_metas(None),
        data: mercurial_vault::instruction::Initialize {}.data(),
    };

    process_and_assert_ok(&[init_vault_ins], admin, &[admin, &base], banks_client).await;

    Vault {
        pubkey: vault,
        token_vault: token_vault,
        lp_mint: lp_mint.pubkey(),
    }
}

pub async fn deposit(
    vault: &Vault,
    user_token: Pubkey,
    user_lp: Pubkey,
    user: &Keypair,
    token_amount: u64,
    banks_client: &mut BanksClient,
) {
    let deposit_ins = Instruction {
        program_id: mercurial_vault::id(),
        accounts: mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault: vault.pubkey,
            token_vault: vault.token_vault,
            lp_mint: vault.lp_mint,
            user_token,
            user_lp,
            user: user.pubkey(),
            token_program: spl_token::id(),
        }
        .to_account_metas(None),
        data: mercurial_vault::instruction::Deposit {
            token_amount,
            minimum_lp_token_amount: 0,
        }
        .data(),
    };

    process_and_assert_ok(&[deposit_ins], user, &[user], banks_client).await;
}

pub async fn withdraw(
    vault: &Vault,
    user_token: Pubkey,
    user_lp: Pubkey,
    user: &Keypair,
    lp_amount: u64,
    banks_client: &mut BanksClient,
) {
    let withdraw_ins = Instruction {
        program_id: mercurial_vault::id(),
        accounts: mercurial_vault::accounts::DepositWithdrawLiquidity {
            vault: vault.pubkey,
            token_vault: vault.token_vault,
            lp_mint: vault.lp_mint,
            user_token,
            user_lp,
            user: user.pubkey(),
            token_program: spl_token::id(),
        }
        .to_account_metas(None),
        data: mercurial_vault::instruction::Withdraw {
            unmint_amount: lp_amount,
            min_out_amount: 0,
        }
        .data(),
    };

    process_and_assert_ok(&[withdraw_ins], user, &[user], banks_client).await;
}
