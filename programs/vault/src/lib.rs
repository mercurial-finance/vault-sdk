pub mod context;
pub mod seed;
pub mod state;
pub mod strategy;
pub mod utils;

use crate::strategy::base::StrategyType;
use anchor_lang::prelude::*;
use context::*;
use std::convert::TryFrom;
use std::str::FromStr;

#[cfg(feature = "staging")]
declare_id!("6YRZW57XsrT2DxSNLXHHQd4QmiqBode4d6btASkRqcFo");

#[cfg(not(feature = "staging"))]
declare_id!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

// Performance fee when rebalancing
pub const PERFORMANCE_FEE_NUMERATOR: u128 = 500u128; // 5%
pub const PERFORMANCE_FEE_DENOMINATOR: u128 = 10000u128;

// get vault address from base key and token mint
// let (vault, _vault_bump) = Pubkey::find_program_address(
//     &[b"vault".as_ref(), token_mint.as_ref(), get_base_key().as_ref()],
//     &program_client.id(),
// );
pub fn get_base_key() -> Pubkey {
    Pubkey::from_str("HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv").unwrap()
}

/// Treasury address
pub fn get_treasury_address() -> Pubkey {
    Pubkey::from_str("9kZeN47U2dubGbbzMrzzoRAUvpuxVLRcjW9XiFpYjUo4").unwrap()
}

pub fn get_base_address_for_idle_vault() -> Pubkey {
    Pubkey::default()
}

#[program]
pub mod vault {
    use super::*;

    #[allow(unused_variables)]
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    #[allow(unused_variables)]
    pub fn initialize_idle_vault(ctx: Context<InitializeIdleVault>) -> Result<()> {
        Ok(())
    }

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

    // simulate function to get unlocked amount
    pub fn get_unlocked_amount(ctx: Context<GetUnlockedAmount>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let current_time = u64::try_from(Clock::get()?.unix_timestamp)
            .ok()
            .ok_or(VaultError::MathOverflow)?;
        let total_amount = vault
            .get_unlocked_amount(current_time)
            .ok_or(VaultError::MathOverflow)?;

        emit!(TotalAmount { total_amount });

        Ok(())
    }

    #[allow(unused_variables)]
    pub fn deposit_strategy<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, RebalanceStrategy<'info>>,
        amount: u64,
    ) -> Result<()> {
        Ok(())
    }

    #[allow(unused_variables)]
    pub fn withdraw_strategy<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, RebalanceStrategy<'info>>,
        amount: u64,
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

    #[msg("Protocol is not supported")]
    ProtocolIsNotSupported,

    #[msg("Reserve does not support token mint")]
    UnMatchReserve,

    #[msg("lockedProfitDegradation is invalid")]
    InvalidLockedProfitDegradation,

    #[msg("Maximum number of strategies have been reached")]
    MaxStrategyReached,

    #[msg("Strategy existed")]
    StrategyExisted,

    #[msg("Invalid unmint amount")]
    InvalidUnmintAmount,

    #[msg("Invalid accounts for strategy")]
    InvalidAccountsForStrategy,

    #[msg("Invalid bump")]
    InvalidBump,

    #[msg("Amount must be greater than 0")]
    AmountMustGreaterThanZero,

    #[msg("Mango is not supported anymore")]
    MangoIsNotSupportedAnymore,

    #[msg("Strategy is not supported")]
    StrategyIsNotSupported,

    #[msg("Pay amount is exceeded")]
    PayAmountIsExeeced,
}

#[event]
pub struct AddLiquidity {
    pub lp_mint_amount: u64,
    pub token_amount: u64,
}

#[event]
pub struct RemoveLiquidity {
    pub lpunmint_amount: u64,
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

#[event]
pub struct ReportLoss {
    pub strategy: Pubkey,
    pub loss: u64,
}

#[event]
pub struct TotalAmount {
    pub total_amount: u64,
}
