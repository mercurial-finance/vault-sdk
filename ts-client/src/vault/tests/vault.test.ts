import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { StaticTokenListResolutionStrategy, TokenInfo } from "@solana/spl-token-registry";
import { Wallet, AnchorProvider } from "@project-serum/anchor";
import Decimal from "decimal.js";

import VaultImpl from "..";
import { airDropSol } from './utils';

const mockWallet = new Wallet(new Keypair());
const mainnetConnection = new Connection("https://api.mainnet-beta.solana.com");
// devnet ATA creation and reading must use confirmed.
const devnetConnection = new Connection("https://api.devnet.solana.com/", { commitment: 'confirmed' });

// Prevent importing directly from .json, causing slowdown on Intellisense
const SOL_TOKEN_INFO = (
  new StaticTokenListResolutionStrategy()
    .resolve()
    .find(token => token.symbol === 'SOL')
) as TokenInfo; // Guaranteed to exist

describe('Get Mainnet vault state', () => {
  let vault: VaultImpl;
  let lpSupply: string;
  beforeAll(async () => {
    vault = await VaultImpl.create(mainnetConnection, { baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address), baseTokenDecimals: SOL_TOKEN_INFO.decimals });
    lpSupply = (await vault.getVaultSupply())
  })

  test("lp supply", async () => {
    expect(typeof lpSupply).toBe('string');
  });

  test("get unlocked amount", async () => {
    const unlockedAmount = await vault.getWithdrawableAmount();
    expect(unlockedAmount).toBeInstanceOf(Decimal);
  })
})

describe('Interact with Vault in devnet', () => {
  const provider = new AnchorProvider(devnetConnection, mockWallet, {
    commitment: "confirmed",
  });

  let vault: VaultImpl;
  beforeAll(async () => {
    await airDropSol(devnetConnection, mockWallet.publicKey);
    vault = await VaultImpl.create(devnetConnection, { baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address), baseTokenDecimals: SOL_TOKEN_INFO.decimals }, { cluster: 'devnet' });
  })

  test("Vault Withdraw SOL", async () => {
    // Deposit
    const depositTx = await vault.deposit(mockWallet.publicKey, 2000);
    const depositResult = await provider.sendAndConfirm(depositTx);
    console.log('Deposit result', depositResult);
    expect(typeof depositResult).toBe("string");

    // Withdraw
    const withdrawTx = await vault.withdraw(mockWallet.publicKey, 1000);
    const withdrawResult = await provider.sendAndConfirm(withdrawTx);
    console.log('Withdraw result', withdrawResult);
    expect(typeof withdrawResult).toBe("string");
  });

  test("Vault Withdraw SOL from strategy", async () => {
    for (var strategy of vault.vaultState.strategies) {
      if (!strategy.equals(PublicKey.default)) {
        console.log("Test with ", strategy.toString());

        // Deposit
        const depositTx = await vault.deposit(mockWallet.publicKey, 1_000_000);
        const depositResult = await provider.sendAndConfirm(depositTx);
        expect(typeof depositResult).toBe("string");

        // Withdraw
        const withdrawTx = await vault.withdrawFromStrategy(mockWallet.publicKey, strategy, 1000);
        if (!(withdrawTx instanceof Transaction)) {
          throw new Error(`Error creating withdrawFromStrategy instruction: ${withdrawTx.error}`);
        }

        try {
          const withdrawResult = await provider.sendAndConfirm(withdrawTx);
          console.log('Strategy withdraw result', withdrawResult)
          expect(typeof withdrawResult).toBe("string");

        } catch (error) {
          console.log('###', error)
        }
      }
    }
  });
})
