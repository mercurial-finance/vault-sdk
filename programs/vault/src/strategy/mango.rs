use crate::ID;
use anchor_lang::prelude::Pubkey;

/// Account num
pub const ACCOUNT_NUM: u32 = 0u32;

/// get strategy owner for mango
pub fn get_strategy_owner(strategy_pubkey: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&["mango".as_ref(), strategy_pubkey.as_ref()], &ID)
}
