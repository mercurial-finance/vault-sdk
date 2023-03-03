#![cfg(feature = "test-bpf")]

mod helpers;

use helpers::*;
use solana_program_test::*;
use solana_sdk::{signature::Keypair, signer::Signer};

#[tokio::test]
async fn test_vault() {
    let test = ProgramTest::new("vault", mercurial_vault::id(), None);

    let (mut banks_client, payer, _recent_blockhash) = test.start().await;

    let usdc_mint = Keypair::new();

    // Create usdc mint
    utils::initialize_mint(&payer, &usdc_mint, &payer.pubkey(), 6, &mut banks_client).await;

    // Create user usdc token account
    let user_usdc = utils::get_or_create_ata(
        &usdc_mint.pubkey(),
        &payer.pubkey(),
        &payer,
        &mut banks_client,
    )
    .await;

    // Mint some token
    utils::mint_to(
        &payer,
        &usdc_mint.pubkey(),
        &user_usdc,
        1_000_000_000,
        &mut banks_client,
    )
    .await;

    // Init vault
    let vault: vault::Vault =
        vault::initialize_vault(usdc_mint.pubkey(), &payer, &mut banks_client).await;

    // Create user vault LP token account
    let user_vault_lp =
        utils::get_or_create_ata(&vault.lp_mint, &payer.pubkey(), &payer, &mut banks_client).await;

    // Deposit to the vault
    vault::deposit(
        &vault,
        user_usdc,
        user_vault_lp,
        &payer,
        100_000_000,
        &mut banks_client,
    )
    .await;

    let user_vault_lp_balance = utils::get_token_account(&user_vault_lp, &mut banks_client)
        .await
        .amount;

    assert_eq!(user_vault_lp_balance, 100_000_000);

    // Withdraw from the vault
    vault::withdraw(
        &vault,
        user_usdc,
        user_vault_lp,
        &payer,
        100_000_000,
        &mut banks_client,
    )
    .await;

    let user_vault_lp_balance = utils::get_token_account(&user_vault_lp, &mut banks_client)
        .await
        .amount;

    assert_eq!(user_vault_lp_balance, 0);
}
