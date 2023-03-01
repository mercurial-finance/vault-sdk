pub mod seed;
pub mod strategy;
pub mod utils;

use anchor_lang::prelude::*;
use std::convert::TryFrom;
use std::fmt::Debug;
use std::str::FromStr;

#[cfg(feature = "staging")]
declare_id!("6YRZW57XsrT2DxSNLXHHQd4QmiqBode4d6btASkRqcFo");

#[cfg(not(feature = "staging"))]
declare_id!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

// Performance fee when rebalancing
pub const PERFORMANCE_FEE_NUMERATOR: u128 = 500u128; // 5%
pub const PERFORMANCE_FEE_DENOMINATOR: u128 = 10000u128;

pub const LOCKED_PROFIT_DEGRADATION_DENOMINATOR: u128 = 1_000_000_000_000;

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

anchor_gen::generate_cpi_interface!(idl_path = "idl.json");

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

impl Debug for Vault {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Vault {{ admin: {:?}, base: {:?}, bumps: {:?}, enabled: {:?}, fee_vault: {:?}, locked_profit_tracker: {:?}, lp_mint: {:?}, operator: {:?}, strategies: {:?}, token_mint: {:?}, token_vault: {:?}, total_amount: {:?} }}",
            self.admin,
            self.base,
            self.bumps,
            self.enabled,
            self.fee_vault,
            self.locked_profit_tracker,
            self.lp_mint,
            self.operator,
            self.strategies,
            self.token_mint,
            self.token_vault,
            self.total_amount
        )
    }
}

impl Debug for Strategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Strategy {{ bumps: {:?}, collateral_vault: {:?}, current_liquidity: {:?}, is_disable: {:?}, reserve: {:?}, strategy_type: {:?}, vault: {:?} }}",
            self.bumps,
            self.collateral_vault,
            self.current_liquidity,
            self.is_disable,
            self.reserve,
            self.strategy_type,
            self.vault
        )
    }
}

#[event]
pub struct TotalAmount {
    pub total_amount: u64,
}
