use crate::context::VaultBumps;
use crate::strategy::base::StrategyType;
use anchor_lang::prelude::*;
use std::convert::TryFrom;
use std::fmt::Debug;

pub const MAX_STRATEGY: usize = 30;
pub const MAX_BUMPS: usize = 10;
pub const LOCKED_PROFIT_DEGRADATION_DENOMINATOR: u128 = 1_000_000_000_000;

#[account]
#[derive(Default, Debug)]
pub struct Vault {
    pub enabled: u8,
    pub bumps: VaultBumps,

    pub total_amount: u64,

    pub token_vault: Pubkey,
    pub fee_vault: Pubkey,
    pub token_mint: Pubkey,

    pub lp_mint: Pubkey,
    pub strategies: [Pubkey; MAX_STRATEGY],

    pub base: Pubkey,
    pub admin: Pubkey,
    pub operator: Pubkey, // person to send crank
    pub locked_profit_tracker: LockedProfitTracker,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct LockedProfitTracker {
    pub last_updated_locked_profit: u64,
    pub last_report: u64,
    pub locked_profit_degradation: u64,
}

impl Default for LockedProfitTracker {
    fn default() -> Self {
        LockedProfitTracker {
            last_updated_locked_profit: 0,
            last_report: 0,
            locked_profit_degradation: u64::try_from(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)
                .unwrap()
                / (6 * 3600), // locked profit is fully dripped in 6 hour
        }
    }
}
impl LockedProfitTracker {
    // based from yearn vault
    // https://github.com/yearn/yearn-vaults/blob/main/contracts/Vault.vy#L825
    pub fn calculate_locked_profit(&self, current_time: u64) -> Option<u64> {
        let duration = u128::from(current_time.checked_sub(self.last_report)?);
        let locked_profit_degradation = u128::from(self.locked_profit_degradation);
        let locked_fund_ratio = duration.checked_mul(locked_profit_degradation)?;

        if locked_fund_ratio > LOCKED_PROFIT_DEGRADATION_DENOMINATOR {
            return Some(0);
        }
        let locked_profit = u128::from(self.last_updated_locked_profit);

        let locked_profit = (locked_profit
            .checked_mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR - locked_fund_ratio)?)
        .checked_div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)?;
        let locked_profit = u64::try_from(locked_profit).ok()?;
        Some(locked_profit)
    }
}

impl Vault {
    pub fn get_unlocked_amount(&self, current_time: u64) -> Option<u64> {
        self.total_amount.checked_sub(
            self.locked_profit_tracker
                .calculate_locked_profit(current_time)?,
        )
    }

    pub fn get_amount_by_share(
        &self,
        current_time: u64,
        share: u64,
        total_supply: u64,
    ) -> Option<u64> {
        let total_amount = self.get_unlocked_amount(current_time)?;
        u64::try_from(
            u128::from(share)
                .checked_mul(u128::from(total_amount))?
                .checked_div(u128::from(total_supply))?,
        )
        .ok()
    }

    pub fn get_unmint_amount(
        &self,
        current_time: u64,
        out_token: u64,
        total_supply: u64,
    ) -> Option<u64> {
        let total_amount = self.get_unlocked_amount(current_time)?;
        u64::try_from(
            u128::from(out_token)
                .checked_mul(u128::from(total_supply))?
                .checked_div(u128::from(total_amount))?,
        )
        .ok()
    }

    pub fn is_strategy_existed(&self, pubkey: Pubkey) -> bool {
        for item in self.strategies.iter() {
            if *item == pubkey {
                return true;
            }
        }
        false
    }
}

impl Default for StrategyType {
    fn default() -> Self {
        StrategyType::PortFinanceWithoutLM
    }
}

#[account]
#[derive(Default, Debug)]
pub struct Strategy {
    pub reserve: Pubkey,
    pub collateral_vault: Pubkey,
    pub strategy_type: StrategyType,
    pub current_liquidity: u64,
    pub bumps: [u8; MAX_BUMPS],
    pub vault: Pubkey,
    pub is_disable: u8,
}
