mod user;
use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::solana_sdk::pubkey::Pubkey;
use anchor_client::Client;
use anchor_client::Cluster;
use anyhow::{Error, Result};
use clap::Parser;
use mercurial_vault::get_base_key;
use mercurial_vault::strategy::base::StrategyType;
use solana_sdk::signature::{read_keypair_file, Keypair};

use user::*;

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

    #[clap(global = true, long = "provider.admin")]
    pub admin: Option<String>,

    #[clap(global = true, long = "provider.base")]
    pub base: Option<String>,
}

#[derive(Debug, Parser)]
pub enum Command {
    Show {},
    #[clap(flatten)]
    User(UserCommand),
}

#[derive(Debug, Parser)]
pub enum UserCommand {
    Deposit { token_amount: u64 },
    Withdraw { unmint_amount: u64 },
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
        None => Cluster::Localnet,
    };

    let client = Client::new_with_options(url, Rc::new(payer), CommitmentConfig::processed());

    let program_id = match opts.cfg_override.program_id {
        Some(program_id) => Pubkey::from_str(&program_id).unwrap(),
        None => mercurial_vault::id(),
    };

    let program_client = client.program(program_id);

    let token_mint = match opts.cfg_override.token_mint {
        Some(token_mint) => Pubkey::from_str(&token_mint).unwrap(),
        None => Pubkey::default(),
    };

    let admin = match opts.cfg_override.admin {
        Some(admin) => Pubkey::from_str(&admin).unwrap(),
        None => program_client.payer().clone(),
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
        Command::User(user) => match user {
            UserCommand::Deposit { token_amount } => {
                deposit(&program_client, token_mint, base, token_amount)?
            }
            UserCommand::Withdraw { unmint_amount } => {
                withdraw(&program_client, token_mint, base, unmint_amount)?
            }
        },
    };

    Ok(())
}

fn show(program_client: &anchor_client::Program, vault: Pubkey) -> Result<()> {
    let vault_data: mercurial_vault::state::Vault = program_client.account(vault)?;
    println!("VAULT DATA: {:#?}", vault_data);
    let token_mint: anchor_spl::token::Mint = program_client.account(vault_data.lp_mint)?;
    println!(
        "TOTAL_AMOUNT: {}, lp_mint {}",
        vault_data.total_amount, token_mint.supply
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

pub fn default_keypair() -> Keypair {
    read_keypair_file(&*shellexpand::tilde("~/.config/solana/id.json"))
        .expect("Requires a keypair file")
}
