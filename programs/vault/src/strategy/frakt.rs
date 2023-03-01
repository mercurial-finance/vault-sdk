use crate::ID;
use anchor_lang::prelude::Pubkey;

/// return vault owner
pub fn get_strategy_owner(strategy_pubkey: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&["frakt".as_ref(), strategy_pubkey.as_ref()], &ID)
}
