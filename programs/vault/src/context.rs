use crate::state::{Strategy, Vault, MAX_BUMPS};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, Debug)]
pub struct VaultBumps {
    pub vault_bump: u8,
    pub token_vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, Debug)]
pub struct StrategyBumps {
    pub strategy_index: u8,
    pub strategy_bump: u8,
    pub collateral_vault_bump: u8,
    pub other_bumps: [u8; MAX_BUMPS],
}

#[derive(Accounts)]
pub struct DepositWithdrawLiquidity<'info> {
    #[account(
        mut,
        has_one = token_vault,
        has_one = lp_mint,
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(mut)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawDirectlyFromStrategy<'info> {
    #[account(
        mut,
        has_one = token_vault,
        has_one = lp_mint,
        has_one = fee_vault,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(mut)]
    pub strategy: Box<Account<'info, Strategy>>,

    /// CHECK: Reserve account
    #[account(mut, constraint = strategy.reserve == reserve.key())]
    pub reserve: AccountInfo<'info>,

    /// CHECK: Strategy program
    pub strategy_program: AccountInfo<'info>,

    #[account( mut, constraint = strategy.collateral_vault == collateral_vault.key())]
    pub collateral_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,

    #[account(mut)]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
