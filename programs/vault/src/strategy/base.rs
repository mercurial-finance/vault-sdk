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
    Mango,
    SolendWithLM,
}

pub fn get_mango_program_id() -> Pubkey {
    return Pubkey::from_str("mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68").unwrap();
}

pub fn get_mango_group_id() -> Pubkey {
    return Pubkey::from_str("98pjRuQjK3qA6gXts96PqZT4Ze5QmnCmt3QYjhbUSPue").unwrap();
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
