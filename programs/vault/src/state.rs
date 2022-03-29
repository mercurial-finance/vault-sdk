use crate::context::VaultBumps;
use crate::strategy::base::StrategyType;
use anchor_lang::prelude::*;
use std::convert::TryFrom;
use std::fmt::Debug;

pub const MAX_STRATEGY: usize = 30;
pub const MAX_BUMPS: usize = 10;

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
}

impl Vault {
    pub fn get_amount_by_share(&self, share: u64, total_supply: u64) -> Option<u64> {
        return u64::try_from(
            u128::from(share)
                .checked_mul(u128::from(self.total_amount))?
                .checked_div(u128::from(total_supply))?,
        )
        .ok();
    }

    pub fn get_unmint_amount(&self, out_token: u64, total_supply: u64) -> Option<u64> {
        return u64::try_from(
            u128::from(out_token)
                .checked_mul(u128::from(total_supply))?
                .checked_div(u128::from(self.total_amount))?,
        )
        .ok();
    }

    pub fn is_strategy_existed(&self, pubkey: Pubkey) -> bool {
        for item in self.strategies.iter() {
            if *item == pubkey {
                return true;
            }
        }
        return false;
    }
}

impl Default for StrategyType {
    fn default() -> Self {
        return StrategyType::PortFinanceWithoutLM;
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
}
