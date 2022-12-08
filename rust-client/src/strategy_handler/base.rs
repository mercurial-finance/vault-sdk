use crate::strategy_handler::apricot_without_lm::ApricotWithoutLMHandler;
use crate::strategy_handler::port_finance_without_lm::PortFinanceWithoutLMHandler;
use crate::strategy_handler::solend_with_lm::SolendWithLMHandler;
use crate::strategy_handler::solend_without_lm::SolendWithoutLMHandler;
use crate::strategy_handler::tulip::TulipHandler;
use anchor_lang::solana_program::pubkey::Pubkey;
use anyhow::Result;
use mercurial_vault::strategy::base::StrategyType;

pub fn get_strategy_handler(strategy_type: StrategyType) -> Box<dyn StrategyHandler> {
    match strategy_type {
        StrategyType::PortFinanceWithoutLM => Box::new(PortFinanceWithoutLMHandler {}),
        StrategyType::PortFinanceWithLM => panic!("Protocol is not supported"),
        StrategyType::SolendWithoutLM => Box::new(SolendWithoutLMHandler {}),
        StrategyType::Mango => panic!("Protocol is not supported"),
        StrategyType::SolendWithLM => Box::new(SolendWithLMHandler {}),
        StrategyType::ApricotWithoutLM => Box::new(ApricotWithoutLMHandler {}),
        StrategyType::Francium => panic!("Not implemented yet"),
        StrategyType::Tulip => Box::new(TulipHandler {}),
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
