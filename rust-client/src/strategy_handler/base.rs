use crate::strategy_handler::mango::MangoHandler;
use crate::strategy_handler::port_finance_without_lm::PortFinanceWithoutLMHandler;
use crate::strategy_handler::solend_with_lm::SolendWithLMHandler;
use crate::strategy_handler::solend_without_lm::SolendWithoutLMHandler;
use anyhow::Result;
use mercurial_vault::strategy::base::StrategyType;
use solana_program::pubkey::Pubkey;

pub fn get_strategy_handler(strategy_type: StrategyType) -> Box<dyn StrategyHandler> {
    match strategy_type {
        StrategyType::PortFinanceWithoutLM => Box::new(PortFinanceWithoutLMHandler {}),
        StrategyType::PortFinanceWithLM => panic!("Protocol is not supported"),
        StrategyType::SolendWithoutLM => Box::new(SolendWithoutLMHandler {}),
        StrategyType::Mango => Box::new(MangoHandler {}),
        StrategyType::SolendWithLM => Box::new(SolendWithLMHandler {}),
        _ => panic!(),
    }
}

pub trait StrategyHandler {
    fn withdraw_directly_from_strategy(
        &self,
        program_client: &anchor_client::Program,
        strategy: Pubkey,
        token_mint: Pubkey,
        base: Pubkey,
        amount: u64,
    ) -> Result<()>;
}
