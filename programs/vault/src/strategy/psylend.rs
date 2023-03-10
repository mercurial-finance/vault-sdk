use anchor_lang::prelude::AccountMeta;
use anchor_lang::solana_program::{self, pubkey::Pubkey, sysvar};
use psylend_cpi::constants::PSYLEND_PROGRAM_KEY;
use solana_program::instruction::Instruction;
use std::str::FromStr;
use crate::ID;

/// get_psylend_program
pub fn get_psylend_program() -> Pubkey {
    Pubkey::from_str(PSYLEND_PROGRAM_KEY).unwrap()
}

/// get deposit account
pub fn get_deposit_account(reserve: Pubkey, depositor: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &["deposits".as_ref(), reserve.as_ref(), depositor.as_ref()],
        &get_psylend_program(),
    )
}
/// get_strategy_owner
pub fn get_strategy_owner(strategy_pubkey: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&["psylend".as_ref(), strategy_pubkey.as_ref()], &ID)
}

/// init instruction
pub fn get_init_instruction(
    market: Pubkey,
    market_authority: Pubkey,
    reserve: Pubkey,
    deposit_note_mint: Pubkey,
    depositor: Pubkey,
    deposit_account: Pubkey,
    bump: u8,
) -> Instruction {
    Instruction {
        program_id: get_psylend_program(),
        accounts: vec![
            AccountMeta::new_readonly(market, false),
            AccountMeta::new_readonly(market_authority, false),
            AccountMeta::new_readonly(reserve, false),
            AccountMeta::new_readonly(deposit_note_mint, false),
            AccountMeta::new(depositor, true),
            AccountMeta::new(deposit_account, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
        ],
        data: psylend_cpi::instructions::get_init_ix_data(bump),
    }
}

// deposit instruction
pub fn get_deposit_instruction(
    market: Pubkey,
    market_authority: Pubkey,
    reserve: Pubkey,
    vault: Pubkey,
    deposit_note_mint: Pubkey,
    depositor: Pubkey,
    deposit_account: Pubkey,
    deposit_source: Pubkey,
    bump: u8,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: get_psylend_program(),
        accounts: vec![
            AccountMeta::new_readonly(market, false),
            AccountMeta::new_readonly(market_authority, false),
            AccountMeta::new(reserve, false),
            AccountMeta::new(vault, false),
            AccountMeta::new(deposit_note_mint, false),
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(deposit_account, false),
            AccountMeta::new(deposit_source, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
        ],
        data: psylend_cpi::instructions::get_deposit_ix_data(
            bump,
            psylend_cpi::Amount {
                units: psylend_cpi::TOKENS,
                value: amount,
            },
        ),
    }
}

/// withdraw instruction
pub fn get_withdraw_instruction(
    market: Pubkey,
    market_authority: Pubkey,
    reserve: Pubkey,
    vault: Pubkey,
    deposit_note_mint: Pubkey,
    depositor: Pubkey,
    deposit_account: Pubkey,
    deposit_source: Pubkey,
    bump: u8,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: get_psylend_program(),
        accounts: vec![
            AccountMeta::new_readonly(market, false),
            AccountMeta::new_readonly(market_authority, false),
            AccountMeta::new(reserve, false),
            AccountMeta::new(vault, false),
            AccountMeta::new(deposit_note_mint, false),
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(deposit_account, false),
            AccountMeta::new(deposit_source, false),
            AccountMeta::new_readonly(get_psylend_program(), false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
        ],
        data: psylend_cpi::instructions::get_withdraw_ix_data(
            bump,
            psylend_cpi::Amount {
                units: psylend_cpi::TOKENS,
                value: amount,
            },
        ),
    }
}
