use crate::ID;
use anchor_lang::prelude::Pubkey;

/// Return user signer PDA
pub fn get_user_signer(strategy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            crate::seed::APRICOT_USER_INFO_SIGNER_PREFIX.as_ref(),
            strategy.as_ref(),
        ],
        &ID,
    )
}
