use crate::get_base_address_for_idle_vault;
use crate::get_base_key;
use crate::get_treasury_address;
use crate::seed;
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

#[derive(Accounts)]
pub struct GetUnlockedAmount<'info> {
    pub vault: Box<Account<'info, Vault>>,
}

#[derive(Accounts)]
pub struct RebalanceStrategy<'info> {
    #[account(
        mut,
        has_one = token_vault,
        has_one = lp_mint,
        has_one = fee_vault,
    )]
    pub vault: Box<Account<'info, Vault>>,
    #[account(mut)]
    pub strategy: Box<Account<'info, Strategy>>,

    #[account(mut)]
    pub token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub lp_mint: Box<Account<'info, Mint>>,

    /// CHECK: Strategy program
    pub strategy_program: AccountInfo<'info>,

    #[account( mut, constraint = strategy.collateral_vault == collateral_vault.key())]
    pub collateral_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: Reserve account
    #[account(mut, constraint = strategy.reserve == reserve.key())]
    pub reserve: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,

    #[account(constraint = vault.admin == operator.key() || vault.operator == operator.key())]
    pub operator: Signer<'info>,
}
/// Accounts for initialize a new vault
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// This is base account for all vault    
    /// No need base key now because we only allow 1 vault per token now
    // pub base: Signer<'info>,

    /// Vault account
    #[account(
        init,
        seeds = [
            seed::VAULT_PREFIX.as_ref(), token_mint.key().as_ref(), get_base_key().as_ref()
        ],
        bump,
        payer = payer,
        space = 8 + std::mem::size_of::<Vault>(),
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// Payer can be anyone
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Token vault account
    #[account(
        init,
        seeds = [seed::TOKEN_VAULT_PREFIX.as_ref(), vault.key().as_ref()],
        bump,
        payer = payer,
        token::mint = token_mint,
        token::authority = vault,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// Token mint account
    pub token_mint: Box<Account<'info, Mint>>, // allocate some accounts in heap to avoid stack frame size limit
    #[account(
        init,
        seeds = [seed::LP_MINT_PREFIX.as_ref(), vault.key().as_ref()],
        bump,
        payer = payer,
        mint::decimals = token_mint.decimals,
        mint::authority = vault,
    )]
    pub lp_mint: Box<Account<'info, Mint>>,
    /// rent
    pub rent: Sysvar<'info, Rent>,
    /// token_program
    pub token_program: Program<'info, Token>,
    /// system_program
    pub system_program: Program<'info, System>,
}

/// Accounts for InitializeIdleVault
#[derive(Accounts)]
pub struct InitializeIdleVault<'info> {
    /// Vault account
    #[account(
        init,
        seeds = [
            seed::VAULT_PREFIX.as_ref(), token_mint.key().as_ref(), get_base_address_for_idle_vault().as_ref()
        ],
        bump,
        payer = payer,
        space = 8 + std::mem::size_of::<Vault>(),
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// Payer can be anyone
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Token vault account
    #[account(
        init,
        seeds = [seed::TOKEN_VAULT_PREFIX.as_ref(), vault.key().as_ref()],
        bump,
        payer = payer,
        token::mint = token_mint,
        token::authority = vault,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// Token mint account
    pub token_mint: Box<Account<'info, Mint>>, // allocate some accounts in heap to avoid stack frame size limit
    /// LP mint
    #[account(
        init,
        seeds = [seed::LP_MINT_PREFIX.as_ref(), vault.key().as_ref()],
        bump,
        payer = payer,
        mint::decimals = token_mint.decimals,
        mint::authority = vault,
    )]
    pub lp_mint: Box<Account<'info, Mint>>,
    /// rent
    pub rent: Sysvar<'info, Rent>,
    /// token_program
    pub token_program: Program<'info, Token>,
    /// system_program
    pub system_program: Program<'info, System>,
}
