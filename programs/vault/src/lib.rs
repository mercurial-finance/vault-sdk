pub mod context;
pub mod state;
pub mod strategy;

use crate::strategy::base::StrategyType;
use anchor_lang::prelude::*;
use context::*;
use std::str::FromStr;

declare_id!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

// get vault address from base key and token mint
// let (vault, _vault_bump) = Pubkey::find_program_address(
//     &[b"vault".as_ref(), token_mint.as_ref(), get_base_key().as_ref()],
//     &program_client.id(),
// );
pub fn get_base_key() -> Pubkey {
    Pubkey::from_str("HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv").unwrap()
}

#[program]
pub mod vault {
    use super::*;

    #[allow(unused_variables)]
    pub fn deposit(
        ctx: Context<DepositWithdrawLiquidity>,
        token_amount: u64,
        minimum_lp_token_amount: u64,
    ) -> Result<()> {
        Ok(())
    }

    #[allow(unused_variables)]
    pub fn withdraw(
        ctx: Context<DepositWithdrawLiquidity>,
        unmint_amount: u64,
        min_out_amount: u64,
    ) -> Result<()> {
        Ok(())
    }

    #[allow(unused_variables)]
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
