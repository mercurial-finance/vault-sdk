pub mod context;
pub mod state;
pub mod strategy;

use crate::strategy::base::StrategyType;
use anchor_lang::prelude::*;
use context::*;

declare_id!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

#[program]
pub mod vault {
    use super::*;

    pub fn deposit(
        ctx: Context<DepositWithdrawLiquidity>,
        token_amount: u64,
        minimum_lp_token_amount: u64,
    ) -> Result<()> {
        Ok(())
    }

    pub fn withdraw(
        ctx: Context<DepositWithdrawLiquidity>,
        unmint_amount: u64,
        min_out_amount: u64,
    ) -> Result<()> {      
        Ok(())
    }

    pub fn withdraw_directly_from_strategy<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, WithdrawDirectlyFromStrategy<'info>>,
        unmint_amount: u64,
        min_out_amount: u64,
    ) -> Result<()> {
        Ok(())
    }
}

#[error_code]
pub enum VaultError {
    #[msg("Vault is disabled")]
    VaultIsDisabled,

    #[msg("Exceeded slippage tolerance")]
    ExceededSlippage,

    #[msg("Strategy is not existed")]
    StrategyIsNotExisted,

    #[msg("UnAuthorized")]
    UnAuthorized,

    #[msg("Math operation overflow")]
    MathOverflow,
}

#[event]
pub struct AddLiquidity {
    pub lp_mint_amount: u64,
    pub token_amount: u64,
}

#[event]
pub struct RemoveLiquidity {
    pub lp_unmint_amount: u64,
    pub token_amount: u64,
}
#[event]
pub struct StrategyDeposit {
    pub strategy_type: StrategyType,
    pub token_amount: u64,
}

#[event]
pub struct StrategyWithdraw {
    pub strategy_type: StrategyType,
    pub collateral_amount: u64,
    pub estimated_token_amount: u64,
}

#[event]
pub struct StakingReward {
    pub strategy_type: StrategyType,
    pub token_amount: u64,
    pub mint_account: Pubkey,
}

#[event]
pub struct PerformanceFee {
    pub lp_mint_more: u64,
}
