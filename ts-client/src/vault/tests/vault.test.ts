import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { StaticTokenListResolutionStrategy, TokenInfo } from '@solana/spl-token-registry';
import { Wallet, AnchorProvider, BN } from '@project-serum/anchor';

import VaultImpl from '..';
import { airDropSol } from './utils';
import { getVaultPdas } from '../utils';
import { PROGRAM_ID } from '../constants';

const mockWallet = new Wallet(new Keypair());
const mainnetConnection = new Connection('https://api.mainnet-beta.solana.com');
// devnet ATA creation and reading must use confirmed.
const devnetConnection = new Connection('https://api.devnet.solana.com/', { commitment: 'confirmed' });

// Prevent importing directly from .json, causing slowdown on Intellisense
const tokenMap = new StaticTokenListResolutionStrategy().resolve();
const SOL_TOKEN_INFO = tokenMap.find((token) => token.symbol === 'SOL') as TokenInfo;
const USDC_TOKEN_INFO = tokenMap.find((token) => token.symbol === 'USDC') as TokenInfo;
const USDT_TOKEN_INFO = tokenMap.find((token) => token.symbol === 'USDT') as TokenInfo;

describe('Get Mainnet vault state', () => {
  let vaults: VaultImpl[] = [];
  let vaultsForPool: VaultImpl[] = [];

  // Make sure all vaults can be initialized
  beforeAll(async () => {
    const tokensInfo = [SOL_TOKEN_INFO, USDC_TOKEN_INFO, USDT_TOKEN_INFO];
    const tokensInfoPda = tokensInfo.map((tokenInfo) => {
      const vaultPdas = getVaultPdas(new PublicKey(tokenInfo.address), new PublicKey(PROGRAM_ID));
      return {
        info: tokenInfo,
        ...vaultPdas,
      };
    });
    vaults = await VaultImpl.createMultiple(mainnetConnection, tokensInfo);
    vaultsForPool = await VaultImpl.createMultipleWithPda(mainnetConnection, tokensInfoPda);
  });

  test('Get LP Supply', async () => {
    const vaultLpSupplies = await Promise.all(
      vaults.map(async (vault) => {
        const lpSupply = await vault.getVaultSupply();

        return lpSupply;
      }),
    );

    vaultLpSupplies.forEach((lpSupply) => {
      expect(Number(lpSupply)).toBeGreaterThan(0);
    });

    const vaultLpSuppliesForPool = await Promise.all(
      vaultsForPool.map(async (vault) => {
        const lpSupply = await vault.getVaultSupply();

        return lpSupply;
      }),
    );

    vaultLpSuppliesForPool.forEach((lpSupply) => {
      expect(Number(lpSupply)).toBeGreaterThan(0);
    });
  });

  test('Get unlocked amount', async () => {
    vaults.forEach(async (vault) => {
      const unlockedAmount = await vault.getWithdrawableAmount();
      expect(Number(unlockedAmount)).toBeGreaterThan(0);
    });
  });
});

describe('Interact with Vault in devnet', () => {
  const provider = new AnchorProvider(devnetConnection, mockWallet, {
    commitment: 'confirmed',
  });

  let vault: VaultImpl;
  beforeAll(async () => {
    await airDropSol(devnetConnection, mockWallet.publicKey);
    vault = await VaultImpl.create(devnetConnection, SOL_TOKEN_INFO, { cluster: 'devnet' });
  });

  test('Deposit, check balance, withdraw', async () => {
    // Deposit
    const depositTx = await vault.deposit(mockWallet.publicKey, new BN(100_000_000));
    const depositResult = await provider.sendAndConfirm(depositTx);
    console.log('Deposit result', depositResult);
    expect(typeof depositResult).toBe('string');

    // Check balance
    const userBalanceDeposit = await vault.getUserBalance(mockWallet.publicKey);
    expect(Number(userBalanceDeposit)).toBeGreaterThan(0);

    // Withdraw all lp
    const withdrawTx = await vault.withdraw(mockWallet.publicKey, userBalanceDeposit);
    const withdrawResult = await provider.sendAndConfirm(withdrawTx);
    console.log('Withdraw result', withdrawResult);
    expect(typeof withdrawResult).toBe('string');

    // Check balance
    const userBalanceWithdraw = await vault.getUserBalance(mockWallet.publicKey);
    expect(Number(userBalanceWithdraw)).toEqual(0);
  });

  test('Vault Withdraw SOL from all strategy', async () => {
    for (var strategy of vault.vaultState.strategies) {
      if (!strategy.equals(PublicKey.default)) {
        console.log('Test with ', strategy.toString());

        // Deposit
        const depositTx = await vault.deposit(mockWallet.publicKey, new BN(1_000_000));
        const depositResult = await provider.sendAndConfirm(depositTx);
        expect(typeof depositResult).toBe('string');

        // Withdraw from specific strategy
        const withdrawTx = await vault.withdraw(mockWallet.publicKey, new BN(1000), { strategy });

        try {
          const withdrawResult = await provider.sendAndConfirm(withdrawTx);
          console.log('Strategy withdraw result', withdrawResult);
          expect(typeof withdrawResult).toBe('string');
        } catch (error) {
          console.log('Error creating withdrawFromStrategy instruction', error);
        }
      }
    }
  });
});
