use anchor_lang::prelude::Pubkey;

use crate::seed;

pub fn derive_vault_address(token_mint: Pubkey, base: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            seed::VAULT_PREFIX.as_ref(),
            token_mint.as_ref(),
            base.as_ref(),
        ],
        &crate::ID,
    )
}

pub fn derive_token_vault_address(vault: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[seed::TOKEN_VAULT_PREFIX.as_ref(), vault.as_ref()],
        &crate::ID,
    )
}

pub fn derive_strategy_address(vault: Pubkey, reserve: Pubkey, index: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[vault.as_ref(), reserve.as_ref(), &[index]], &crate::ID)
}

pub fn derive_collateral_vault_address(strategy: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[seed::COLLATERAL_VAULT_PREFIX.as_ref(), strategy.as_ref()],
        &crate::ID,
    )
}
