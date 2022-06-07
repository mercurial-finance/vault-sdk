mod strategy_handler;
mod user;
mod utils;
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::Client;
use anchor_client::Cluster;
use anchor_lang::solana_program::clock::Clock;
use anyhow::Result;
use bincode::deserialize;
use clap::Parser;
use mercurial_vault::get_base_key;
use solana_program::sysvar;
use solana_sdk::signature::{read_keypair_file, Keypair};
use strategy_handler::base::get_strategy_handler;

use user::*;

use std::convert::TryFrom;
use std::rc::Rc;
use std::str::FromStr;

#[derive(Default, Debug, Parser)]
pub struct ConfigOverride {
    /// Cluster override.
    #[clap(global = true, long = "provider.cluster")]
    pub cluster: Option<Cluster>,
    /// Wallet override.
    #[clap(global = true, long = "provider.wallet")]
    pub wallet: Option<String>,

    /// Program id override
    #[clap(global = true, long = "provider.program_id")]
    pub program_id: Option<String>,

    /// Token mint override
    #[clap(global = true, long = "provider.token_mint")]
    pub token_mint: Option<String>,

    #[clap(global = true, long = "provider.base")]
    pub base: Option<String>,
}

#[derive(Debug, Parser)]
pub enum Command {
    Show {},
    GetUnlockedAmount {},
    #[clap(flatten)]
    User(UserCommand),
}

#[derive(Debug, Parser)]
pub enum UserCommand {
    Deposit {
        token_amount: u64,
    },
    Withdraw {
        unmint_amount: u64,
    },
    WithdrawFromStrategy {
        unmint_amount: u64,
        strategy: Pubkey,
    },
}

#[derive(Parser)]
pub struct Opts {
    #[clap(flatten)]
    pub cfg_override: ConfigOverride,
    #[clap(subcommand)]
    pub command: Command,
}
fn main() -> Result<()> {
    let opts = Opts::parse();

    let payer = match opts.cfg_override.wallet {
        Some(wallet) => read_keypair_file(wallet).expect("Requires a keypair file"),
        None => default_keypair(),
    };
    let url = match opts.cfg_override.cluster {
        Some(cluster) => cluster,
        None => Cluster::Mainnet,
    };

    let client = Client::new_with_options(
        url,
        Rc::new(Keypair::from_bytes(&payer.to_bytes())?),
        CommitmentConfig::processed(),
    );

    let program_id = match opts.cfg_override.program_id {
        Some(program_id) => Pubkey::from_str(&program_id).unwrap(),
        None => mercurial_vault::id(),
    };

    let program_client = client.program(program_id);

    let token_mint = match opts.cfg_override.token_mint {
        Some(token_mint) => Pubkey::from_str(&token_mint).unwrap(),
        None => Pubkey::default(),
    };

    let base = match opts.cfg_override.base {
        Some(base) => Pubkey::from_str(&base).unwrap(),
        None => get_base_key(),
    };

    let (vault, _) = Pubkey::find_program_address(
        &[b"vault".as_ref(), token_mint.as_ref(), base.as_ref()],
        &program_id,
    );

    println!("ProgramID {}", program_id.to_string());
    println!("TOKEN MINT {}", token_mint);
    println!("Base {}", base);
    println!("VAULT {}", vault);

    // Fee payer is the admin
    match opts.command {
        Command::Show {} => show(&program_client, vault)?,
        Command::GetUnlockedAmount {} => get_unlocked_amount(&program_client, vault, &payer)?,
        Command::User(user) => match user {
            UserCommand::Deposit { token_amount } => {
                deposit(&program_client, token_mint, base, token_amount)?
            }
            UserCommand::Withdraw { unmint_amount } => {
                withdraw(&program_client, token_mint, base, unmint_amount)?
            }
            UserCommand::WithdrawFromStrategy {
                unmint_amount,
                strategy,
            } => {
                let strategy_state: mercurial_vault::state::Strategy =
                    program_client.account(strategy)?;

                let strategy_handler = get_strategy_handler(strategy_state.strategy_type);
                strategy_handler.withdraw_directly_from_strategy(
                    &program_client,
                    strategy,
                    token_mint,
                    base,
                    unmint_amount,
                )?
            }
        },
    };

    Ok(())
}

fn show(program_client: &anchor_client::Program, vault: Pubkey) -> Result<()> {
    let vault_data: mercurial_vault::state::Vault = program_client.account(vault)?;
    println!("VAULT DATA: {:#?}", vault_data);
    let token_mint: anchor_spl::token::Mint = program_client.account(vault_data.lp_mint)?;

    let current_timestamp = get_current_node_clock_time(program_client)?;

    println!(
        "TOTAL_AMOUNT: {}, TOTAL_UNLOCKED_AMOUNT: {}, lp_mint {}",
        vault_data.total_amount,
        vault_data.get_unlocked_amount(current_timestamp).unwrap(),
        token_mint.supply
    );

    let token_data: anchor_spl::token::TokenAccount =
        program_client.account(vault_data.token_vault)?;

    println!("TOKEN AMOUNT: {}", token_data.amount);

    let mut strategy_amount = 0u64;
    for (i, &strategy_pubkey) in vault_data.strategies.iter().enumerate() {
        if strategy_pubkey != Pubkey::default() {
            let strategy_state: mercurial_vault::state::Strategy =
                program_client.account(strategy_pubkey)?;

            println!("STRATEGY DATA {}: {:#?}", strategy_pubkey, strategy_state);

            strategy_amount += strategy_state.current_liquidity;
        }
    }
    assert_eq!(vault_data.total_amount, token_data.amount + strategy_amount);
    println!("Ok");
    Ok(())
}

pub fn get_current_node_clock_time(program_client: &anchor_client::Program) -> Result<u64> {
    let rpc = program_client.rpc();
    let clock_account = rpc.get_account(&sysvar::clock::id())?;
    let clock = deserialize::<Clock>(&clock_account.data)?;
    let current_time = u64::try_from(clock.unix_timestamp)?;
    Ok(current_time)
}

fn get_unlocked_amount(
    program_client: &anchor_client::Program,
    vault: Pubkey,
    payer: &Keypair,
) -> Result<()> {
    let builder = program_client
        .request()
        .accounts(mercurial_vault::accounts::GetUnlockedAmount { vault })
        .args(mercurial_vault::instruction::GetUnlockedAmount {});

    let simulation = utils::simulate_transaction(&builder, &program_client, &vec![payer]).unwrap();
    let logs = simulation.value.logs.expect("No log in simulation found");
    let unlocked_amount: mercurial_vault::TotalAmount =
        utils::parse_event_log(&logs).expect("Event log not found");
    println!("UNLOCKED AMOUNT: {}", unlocked_amount.total_amount);
    Ok(())
}

pub fn default_keypair() -> Keypair {
    read_keypair_file(&*shellexpand::tilde("~/.config/solana/id.json"))
        .expect("Requires a keypair file")
}
