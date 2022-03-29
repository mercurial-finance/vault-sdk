use anchor_lang::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Serialize, Deserialize,
)]
pub enum StrategyType {
    PortFinanceWithoutLM,
    PortFinanceWithLM,
    SolendWithoutLM,
    Mango,
    // SolendWithLM, // TODO implement
}