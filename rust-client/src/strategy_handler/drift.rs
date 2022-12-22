use std::collections::HashMap;

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
use drift::state::spot_market::SpotMarket;
use drift::state::user::SpotPosition;

pub struct DriftHandler {}

struct RemainingAccounts {
    oracle: Vec<AccountMeta>,
    spot_market: Vec<AccountMeta>,
}

fn insert_readable_account_metas(
    market_index: u16,
    client: &Program,
    oracle_map: &mut HashMap<u16, AccountMeta>,
    spot_market_map: &mut HashMap<u16, AccountMeta>,
) -> Result<()> {
    let (spot_market_pubkey, _bumps) =
        Pubkey::find_program_address(&[b"spot_market", &market_index.to_le_bytes()], &drift::ID);

    if spot_market_map.contains_key(&market_index) {
        spot_market_map.insert(
            market_index,
            AccountMeta {
                pubkey: spot_market_pubkey,
                is_signer: false,
                is_writable: false,
            },
        );
    } else {
        let spot_market = client.account::<SpotMarket>(spot_market_pubkey)?;

        if spot_market.oracle != Pubkey::default() {
            oracle_map.insert(
                spot_market.market_index,
                AccountMeta {
                    pubkey: spot_market.oracle,
                    is_signer: false,
                    is_writable: false,
                },
            );
        }

        spot_market_map.insert(
            spot_market.market_index,
            AccountMeta {
                pubkey: spot_market_pubkey,
                is_signer: false,
                is_writable: false,
            },
        );
    }
    Ok(())
}

fn get_markets_and_oracles(
    spot_market: &SpotMarket,
    spot_positions: &[SpotPosition],
    client: &Program,
    readable_spot_market_index: Option<u16>,
) -> Result<RemainingAccounts> {
    let mut oracle_map: HashMap<u16, AccountMeta> = HashMap::new();
    let mut spot_market_map: HashMap<u16, AccountMeta> = HashMap::new();

    for spot_position in spot_positions.iter() {
        if !spot_position.is_available() && spot_position.market_index != spot_market.market_index {
            insert_readable_account_metas(
                spot_position.market_index,
                client,
                &mut oracle_map,
                &mut spot_market_map,
            )?;
        }
    }

    if let Some(readable_spot_market_index) = readable_spot_market_index {
        if readable_spot_market_index != spot_market.market_index {
            insert_readable_account_metas(
                readable_spot_market_index,
                client,
                &mut oracle_map,
                &mut spot_market_map,
            )?;
        }
    }

    if spot_market.oracle != Pubkey::default() {
        oracle_map.insert(
            spot_market.market_index,
            AccountMeta {
                pubkey: spot_market.oracle,
                is_signer: false,
                is_writable: false,
            },
        );
    }

    let oracle_accounts = oracle_map.values().cloned().collect();
    let spot_market_accounts = spot_market_map.values().cloned().collect();

    Ok(RemainingAccounts {
        oracle: oracle_accounts,
        spot_market: spot_market_accounts,
    })
}

fn get_strategy_accounts_for_withdrawal(
    vault_key: Pubkey,
    strategy_key: Pubkey,
    client: &Program,
) -> Result<Vec<AccountMeta>> {
    let strategy_state = client.account::<mercurial_vault::state::Strategy>(strategy_key)?;

    let (user_stats_pubkey, _bump) =
        Pubkey::find_program_address(&[b"user_stats", vault_key.as_ref()], &drift::ID);

    let mut u16_bytes = [0u8; 2];
    u16_bytes.copy_from_slice(&strategy_state.bumps[0..2]);
    let sub_account_id = u16::from_le_bytes(u16_bytes);

    let (user_pubkey, _bump) = Pubkey::find_program_address(
        &[
            b"user",
            vault_key.as_ref(),
            sub_account_id.to_le_bytes().as_ref(),
        ],
        &drift::ID,
    );

    let (state_pubkey, _bump) = Pubkey::find_program_address(&[b"drift_state"], &drift::ID);

    let spot_market = client.account::<SpotMarket>(strategy_key)?;
    let user = client.account::<drift::state::user::User>(user_pubkey)?;

    let (drift_signer, _bump) = Pubkey::find_program_address(&[b"drift_signer"], &drift::ID);

    let mut remaining_accounts = vec![
        AccountMeta::new(user_pubkey, false),
        AccountMeta::new(user_stats_pubkey, false),
        AccountMeta::new(spot_market.vault, false),
        AccountMeta::new_readonly(state_pubkey, false),
        AccountMeta::new_readonly(drift_signer, false),
    ];

    let RemainingAccounts {
        mut oracle,
        mut spot_market,
    } = get_markets_and_oracles(
        &spot_market,
        &user.spot_positions,
        client,
        Some(drift::math::constants::QUOTE_SPOT_MARKET_INDEX),
    )?;

    remaining_accounts.append(&mut oracle);
    remaining_accounts.append(&mut spot_market);

    Ok(remaining_accounts)
}

impl StrategyHandler for DriftHandler {
    fn withdraw_directly_from_strategy(
        &self,
        program_client: &anchor_client::Program,
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

        let (collateral_vault, _bump) = Pubkey::find_program_address(
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
            strategy_program: drift::ID,
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

        let mut remaining_accounts =
            get_strategy_accounts_for_withdrawal(vault, strategy, program_client)?;
        accounts.append(&mut remaining_accounts);

        let ix = Instruction {
            program_id: mercurial_vault::id(),
            accounts,
            data: mercurial_vault::instruction::WithdrawDirectlyFromStrategy {
                unmint_amount: amount,
                min_out_amount: 0,
            }
            .data(),
        };

        let builder = program_client.request();
        let builder = builder.instruction(ix);

        let signature = builder.send()?;
        println!("{}", signature);

        Ok(())
    }
}
