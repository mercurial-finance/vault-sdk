use crate::ID;
use anchor_lang::solana_program::pubkey::Pubkey;

/// return strategy owner
pub fn get_strategy_owner(strategy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&["marginfi_strategy".as_ref(), strategy.as_ref()], &ID)
}

/// get_marginfi_account
pub fn get_marginfi_account(strategy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&["marginfi_account".as_ref(), strategy.as_ref()], &ID)
}
