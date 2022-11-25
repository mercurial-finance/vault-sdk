use crate::strategy_handler::base::StrategyHandler;
use crate::user::get_or_create_ata;
use anchor_client::solana_sdk::instruction::AccountMeta;
use anchor_client::solana_sdk::instruction::Instruction;
use anchor_client::Program;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::InstructionData;
use anchor_lang::ToAccountMetas;
use anchor_spl::token::spl_token;
use anyhow::Result;
use apricot_client::config;
use apricot_client::consts;
use apricot_client::instructions;
use mercurial_vault::strategy::base::get_apricot_program_id;
pub struct ApricotWithoutLMHandler {}

impl StrategyHandler for ApricotWithoutLMHandler {
    fn withdraw_directly_from_strategy(
        &self,
        program_client: &Program,
        strategy: Pubkey,
        token_mint: Pubkey,
        base: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let (vault, _vault_bump) = Pubkey::find_program_address(
            &[b"vault".as_ref(), token_mint.as_ref(), base.as_ref()],
            &program_client.id(),
        );

        let vault_state: mercurial_vault::state::Vault = program_client.account(vault)?;
        let strategy_state: mercurial_vault::state::Strategy = program_client.account(strategy)?;

        let (collateral_vault, _collateral_vault_bump) = Pubkey::find_program_address(
            &[
                mercurial_vault::seed::COLLATERAL_VAULT_PREFIX.as_ref(),
                strategy.as_ref(),
            ],
            &mercurial_vault::id(),
        );

        let lp_mint = vault_state.lp_mint;

        let user_token = get_or_create_ata(program_client, token_mint, program_client.payer())?;
        let user_lp = get_or_create_ata(program_client, lp_mint, program_client.payer())?;
        let mut accounts = mercurial_vault::accounts::WithdrawDirectlyFromStrategy {
            vault,
            strategy,
            reserve: strategy_state.reserve,
            strategy_program: get_apricot_program_id(),
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
        let pool_id = config::get_pool_id_by_token_mint(vault_state.token_mint);
        let asset_pool_spl = consts::get_asset_pool_spl_k(&spl_token::ID, pool_id);
        let pool_summaries = consts::get_pool_summaries_k();
        let price_summaries = consts::get_price_summaries_k();
        let user_pages_stats = consts::get_user_pages_stats_k();
        let base_pda = consts::base_pda::id();

        let (user_info_signer_pda, _user_info_signer_bump) = Pubkey::find_program_address(
            &[
                mercurial_vault::seed::APRICOT_USER_INFO_SIGNER_PREFIX.as_ref(),
                strategy.as_ref(),
            ],
            &mercurial_vault::ID,
        );
        let user_info = consts::get_user_info_k(&user_info_signer_pda);

        let mut remaining_accounts = vec![
            AccountMeta::new(user_info, false),
            AccountMeta::new(asset_pool_spl, false),
            AccountMeta::new(pool_summaries, false),
            AccountMeta::new(price_summaries, false),
            AccountMeta::new(user_info_signer_pda, false),
            AccountMeta::new(base_pda, false),
            AccountMeta::new(user_pages_stats, false),
        ];
        accounts.append(&mut remaining_accounts);

        let instructions = vec![
            instructions::refresh_user(&user_info_signer_pda),
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
