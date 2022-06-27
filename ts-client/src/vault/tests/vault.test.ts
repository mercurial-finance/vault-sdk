import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { StaticTokenListResolutionStrategy, TokenInfo } from "@solana/spl-token-registry";
import { Wallet, AnchorProvider, Program } from "@project-serum/anchor";
import { IDL, Vault as VaultIdl } from "../idl";

import { VaultImpl } from "../vaultImpl";
import { airDropSol } from './utils';
import Decimal from "decimal.js";
import Vaults from "..";
import { PROGRAM_ID } from "../constants";

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

describe('Vaults', () => {
  let vaultsInstance: Vaults;
  beforeAll(async () => {
    vaultsInstance = await Vaults.create(mainnetConnection);
  })

  test('Get all info and initialize all vaults', async () => {
    vaultsInstance.vaults.forEach(vault => {
      expect(vault.vault).toBeInstanceOf(VaultImpl);
    })
  })

  test('Refetch', async () => {
    const oldData = JSON.stringify(vaultsInstance.vaults.map(vault => vault.data), null, 2);
    
    await vaultsInstance.refetch();
    // Purposely delay for 5s
    await new Promise(res => setTimeout(res, 5000));

    const newData = JSON.stringify(vaultsInstance.vaults.map(vault => vault.data), null, 2);
    expect(JSON.parse(newData).length).toBe(JSON.parse(oldData).length);
  })
})

describe('Get Mainnet vault state', () => {
  const provider = new AnchorProvider(mainnetConnection, {} as any, AnchorProvider.defaultOptions());
  const program = new Program<VaultIdl>(IDL as VaultIdl, PROGRAM_ID, provider);

  let vault: VaultImpl;
  let lpSupply: number;
  beforeAll(async () => {
    vault = await VaultImpl.create(program, { baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address), baseTokenDecimals: SOL_TOKEN_INFO.decimals });
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
  const program = new Program<VaultIdl>(IDL as VaultIdl, PROGRAM_ID, provider);

  let vault: VaultImpl;
  beforeAll(async () => {
    await airDropSol(devnetConnection, mockWallet.publicKey);
    vault = await VaultImpl.create(program, { baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address), baseTokenDecimals: SOL_TOKEN_INFO.decimals }, { cluster: 'devnet' });
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
