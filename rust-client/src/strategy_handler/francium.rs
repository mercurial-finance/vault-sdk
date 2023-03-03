use crate::strategy_handler::base::StrategyHandler;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::Program;
use anyhow::Result;
pub struct FranciumHandler {}

impl StrategyHandler for FranciumHandler {
    fn withdraw_directly_from_strategy(
        &self,
        _program_client: &Program,
        _strategy: Pubkey,
        _token_mint: Pubkey,
        _base: Pubkey,
        _amount: u64,
    ) -> Result<()> {
        panic!("Not implemented yet");
    }
}
