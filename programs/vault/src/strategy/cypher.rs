use crate::ID;
use anchor_lang::prelude::Pubkey;

/// Return strategy owner PDA
pub fn get_strategy_owner(strategy_pubkey: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"cypher", strategy_pubkey.as_ref()], &ID)
}
