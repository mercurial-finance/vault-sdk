import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { StaticTokenListResolutionStrategy, TokenInfo } from "@solana/spl-token-registry";
import { Wallet, AnchorProvider } from "@project-serum/anchor";

import { VaultImpl } from "../index";
import { airDropSol } from './utils';
import Decimal from "decimal.js";

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
  let lpSupply: number;
  beforeAll(async () => {
    vault = await VaultImpl.create(mainnetConnection, { baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address), baseTokenDecimals: SOL_TOKEN_INFO.decimals });
    lpSupply = (await vault.getVaultSupply()).toNumber()
  })

  test("lp supply", async () => {
    expect(typeof lpSupply).toBe('number');
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
    vault = await VaultImpl.create(devnetConnection, { baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address), baseTokenDecimals: SOL_TOKEN_INFO.decimals });
  })

  test("Vault Withdraw SOL", async () => {
    // Deposit
    const depositTx = await vault.deposit(mockWallet, new Decimal(2000));
    const depositResult = await provider.sendAndConfirm(depositTx);
    console.log('Deposit result', depositResult);
    expect(typeof depositResult).toBe("string");

    // Withdraw
    const withdrawTx = await vault.withdraw(mockWallet, new Decimal(1000));
    const withdrawResult = await provider.sendAndConfirm(withdrawTx);
    console.log('Withdraw result', withdrawResult);
    expect(typeof withdrawResult).toBe("string");
  });

  test("Vault Withdraw SOL from strategy", async () => {
    for (var strategy of vault.vaultState.strategies) {
      if (!strategy.equals(PublicKey.default)) {
        console.log("Test with ", strategy.toString());

        // Deposit
        const depositTx = await vault.deposit(mockWallet, new Decimal(1_000_000));
        const depositResult = await provider.sendAndConfirm(depositTx);
        expect(typeof depositResult).toBe("string");

        // Withdraw
        const withdrawTx = await vault.withdrawFromStrategy(mockWallet, strategy, new Decimal(1000));
        if (!(withdrawTx instanceof Transaction)) {
          throw new Error(`Error creating withdrawFromStrategy instruction: ${withdrawTx.error}`);
        }

        const withdrawResult = await provider.sendAndConfirm(withdrawTx);
        console.log('Strategy withdraw result', withdrawResult)
        expect(typeof withdrawResult).toBe("string");
      }
    }
  });
})
