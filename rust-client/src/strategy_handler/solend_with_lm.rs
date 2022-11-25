use crate::strategy_handler::base::StrategyHandler;
use crate::strategy_handler::solend_adapter::SolendReserve;
use crate::user::get_or_create_ata;
use anchor_lang::InstructionData;
use anchor_lang::ToAccountMetas;
use anyhow::Result;
use mercurial_vault::seed;
use mercurial_vault::strategy::base::get_solend_program_id;
use solana_program::pubkey::Pubkey;
use solana_program::sysvar;
use solana_sdk::instruction::AccountMeta;
use solana_sdk::instruction::Instruction;
pub struct SolendWithLMHandler {}

impl StrategyHandler for SolendWithLMHandler {
    fn get_withdraw2_remaining_accounts(
        &self,
        program_client: &anchor_client::Program,
        strategy: Pubkey,
        token_mint: Pubkey,
        base: Pubkey,
    ) -> Result<Vec<AccountMeta>> {
        let (vault, _vault_bump) = Pubkey::find_program_address(
            &[
                mercurial_vault::seed::VAULT_PREFIX.as_ref(),
                token_mint.as_ref(),
                base.as_ref(),
            ],
            &program_client.id(),
        );

        let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
        let strategy_state: mercurial_vault::state::Strategy = program_client.account(strategy)?;

        let reserve_state: SolendReserve = program_client.account(strategy_state.reserve)?;
        let collateral_mint = reserve_state.collateral.mint_pubkey;

        let (lending_market_authority, _bump_seed) = Pubkey::find_program_address(
            &[&reserve_state.lending_market.as_ref()],
            &get_solend_program_id(),
        );

        let (obligation, _obligation_bump) = Pubkey::find_program_address(
            &[seed::SOLEND_OBLIGATION_PREFIX.as_ref(), vault.as_ref()],
            &mercurial_vault::id(),
        );

        let (obligation_owner, _obligation_owner_bump) = Pubkey::find_program_address(
            &[
                seed::SOLEND_OBLIGATION_OWNER_PREFIX.as_ref(),
                vault.as_ref(),
            ],
            &mercurial_vault::id(),
        );

        let mut withdraw2_remaining_accounts = vec![
            AccountMeta::new(strategy, false),
            AccountMeta::new(strategy_state.reserve, false),
            AccountMeta::new_readonly(get_solend_program_id(), false),
            AccountMeta::new(strategy_state.collateral_vault, false),
            AccountMeta::new(vault_state.fee_vault, false),
        ];

        let mut solend_remaining_accounts = vec![
            AccountMeta::new(reserve_state.collateral.supply_pubkey, false),
            AccountMeta::new(reserve_state.liquidity.supply_pubkey, false),
            AccountMeta::new_readonly(reserve_state.lending_market, false),
            AccountMeta::new_readonly(lending_market_authority, false),
            AccountMeta::new(collateral_mint, false),
            AccountMeta::new(obligation, false),
            AccountMeta::new_readonly(obligation_owner, false),
            AccountMeta::new_readonly(reserve_state.liquidity.pyth_oracle_pubkey, false),
            AccountMeta::new_readonly(reserve_state.liquidity.switchboard_oracle_pubkey, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ];

        withdraw2_remaining_accounts.append(&mut solend_remaining_accounts);
        Ok(withdraw2_remaining_accounts)
    }

    fn withdraw_directly_from_strategy(
        &self,
        program_client: &anchor_client::Program,
        strategy: Pubkey,
        token_mint: Pubkey,
        base: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let (vault, _vault_bump) = Pubkey::find_program_address(
            &[
                mercurial_vault::seed::VAULT_PREFIX.as_ref(),
                token_mint.as_ref(),
                base.as_ref(),
            ],
            &program_client.id(),
        );

        let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
        let strategy_state: mercurial_vault::state::Strategy = program_client.account(strategy)?;

        let reserve = strategy_state.reserve;
        let reserve_state: SolendReserve = program_client.account(strategy_state.reserve)?;

        let collateral_mint = reserve_state.collateral.mint_pubkey;
        let (collateral_vault, _collateral_vault_bump) = Pubkey::find_program_address(
            &[
                mercurial_vault::seed::COLLATERAL_VAULT_PREFIX.as_ref(),
                strategy.as_ref(),
            ],
            &mercurial_vault::id(),
        );

        let (lending_market_authority, _bump_seed) = Pubkey::find_program_address(
            &[&reserve_state.lending_market.as_ref()],
            &get_solend_program_id(),
        );

        let (obligation, _obligation_bump) = Pubkey::find_program_address(
            &[seed::SOLEND_OBLIGATION_PREFIX.as_ref(), vault.as_ref()],
            &mercurial_vault::id(),
        );

        let (obligation_owner, _obligation_owner_bump) = Pubkey::find_program_address(
            &[
                seed::SOLEND_OBLIGATION_OWNER_PREFIX.as_ref(),
                vault.as_ref(),
            ],
            &mercurial_vault::id(),
        );

        let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
        let user_lp =
            get_or_create_ata(program_client, vault_state.lp_mint, program_client.payer())?;
        let mut accounts = mercurial_vault::accounts::WithdrawDirectlyFromStrategy {
            vault,
            strategy,
            reserve,
            strategy_program: get_solend_program_id(),
            collateral_vault,
            token_vault: vault_state.token_vault,
            fee_vault: vault_state.fee_vault,
            lp_mint: vault_state.lp_mint,
            user_token,
            user_lp,
            user: program_client.payer(),
            token_program: spl_token::id(),
        }
        .to_account_metas(None);
        let mut remaining_accounts = vec![
            AccountMeta::new(reserve_state.collateral.supply_pubkey, false),
            AccountMeta::new(reserve_state.liquidity.supply_pubkey, false),
            AccountMeta::new_readonly(reserve_state.lending_market, false),
            AccountMeta::new_readonly(lending_market_authority, false),
            AccountMeta::new(collateral_mint, false),
            AccountMeta::new(obligation, false),
            AccountMeta::new_readonly(obligation_owner, false),
            AccountMeta::new_readonly(reserve_state.liquidity.pyth_oracle_pubkey, false),
            AccountMeta::new_readonly(reserve_state.liquidity.switchboard_oracle_pubkey, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ];

        accounts.append(&mut remaining_accounts);

        let instructions = vec![
            solend_program::instruction::refresh_reserve(
                get_solend_program_id(),
                strategy_state.reserve,
                reserve_state.liquidity.pyth_oracle_pubkey,
                reserve_state.liquidity.switchboard_oracle_pubkey,
            ),
            solend_program::instruction::refresh_obligation(
                get_solend_program_id(),
                obligation,
                vec![strategy_state.reserve],
            ),
            Instruction {
                program_id: mercurial_vault::id(),
                accounts,
                data: mercurial_vault::instruction::WithdrawDirectlyFromStrategy {
                    unmint_amount: amount,
                    min_out_amount: 0,
                }
                .data(),
            },
        ];

        let builder = program_client.request();
        let builder = instructions
            .into_iter()
            .fold(builder, |bld, ix| bld.instruction(ix));

        let signature = builder.send()?;
        println!("{}", signature);
        Ok(())
    }
}
