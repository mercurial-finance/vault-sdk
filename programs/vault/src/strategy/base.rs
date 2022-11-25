use anchor_lang::prelude::*;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Serialize, Deserialize,
)]
pub enum StrategyType {
    PortFinanceWithoutLM,
    PortFinanceWithLM,
    SolendWithoutLM,
    Mango, // Mango is no longer supported
    SolendWithLM,
    ApricotWithoutLM,
    Francium,
    Tulip,
}

pub fn get_tulip_program_id() -> Pubkey {
    Pubkey::from_str("4bcFeLv4nydFrsZqV5CgwCVrPhkQKsXtzfy2KyMz7ozM").unwrap()
}

pub fn get_francium_program_id() -> Pubkey {
    Pubkey::from_str("FC81tbGt6JWRXidaWYFXxGnTk4VgobhJHATvTRVMqgWj").unwrap()
}

pub fn get_apricot_program_id() -> Pubkey {
    Pubkey::from_str("6UeJYTLU1adaoHWeApWsoj1xNEDbWA2RhM2DLc8CrDDi").unwrap()
}

#[cfg(feature = "devnet")]
pub fn get_port_finance_program_id() -> Pubkey {
    Pubkey::from_str("pdQ2rQQU5zH2rDgZ7xH2azMBJegUzUyunJ5Jd637hC4").unwrap()
}

#[cfg(not(feature = "devnet"))]
pub fn get_port_finance_program_id() -> Pubkey {
    Pubkey::from_str("Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR").unwrap()
}

#[cfg(feature = "devnet")]
pub fn get_solend_program_id() -> Pubkey {
    Pubkey::from_str("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx").unwrap()
}

#[cfg(not(feature = "devnet"))]
pub fn get_solend_program_id() -> Pubkey {
    Pubkey::from_str("So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo").unwrap()
}
