import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet, AnchorProvider, BN } from '@coral-xyz/anchor';

import VaultImpl from '..';
import { airDropSol } from './utils';
import { NATIVE_MINT } from '@solana/spl-token';
import fs from "fs";
import os from 'os'

let mockWallet = new Wallet(new Keypair());

// devnet ATA creation and reading must use confirmed.
const devnetConnection = new Connection('https://api.devnet.solana.com/', { commitment: 'confirmed' });


// TODO: Remove this fake partner ID
const TEMPORARY_PARTNER_PUBLIC_KEY = new PublicKey('7236FoaWTXJyzbfFPZcrzg3tBpPhGiTgXsGWvjwrYfiF');
describe('Interact with Vault in devnet', () => {
  const provider = new AnchorProvider(devnetConnection, mockWallet, {
    commitment: 'confirmed',
  });

  let vaultImpl: VaultImpl;
  beforeAll(async () => {
    await airDropSol(devnetConnection, mockWallet.publicKey);
    vaultImpl = await VaultImpl.create(devnetConnection, NATIVE_MINT, {
      cluster: 'devnet',
      affiliateId: TEMPORARY_PARTNER_PUBLIC_KEY,
    });
  });

  test('Test affiliate init user, check balance, deposits, then withdraw all', async () => {
    // First deposit
    const depositTx = await vaultImpl.deposit(mockWallet.publicKey, new BN(100_000_000));
    const depositResult = await provider.sendAndConfirm(depositTx);
    console.log('Deposit result', depositResult);
    expect(typeof depositResult).toBe('string');

    // Check balance
    const userBalanceDeposit = await vaultImpl.getUserBalance(mockWallet.publicKey);
    expect(Number(userBalanceDeposit)).toBeGreaterThan(0);

    // Subsequent deposit should not create ATA, and no need to init user
    const depositTx2 = await vaultImpl.deposit(mockWallet.publicKey, new BN(100_000_000));
    expect(depositTx2.instructions.map((ix) => ix.programId.toString())).toEqual([
      '11111111111111111111111111111111', // Wrap SOL
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Sync nativve
      'GacY9YuN16HNRTy7ZWwULPccwvfFSBeNLuAQP7y38Du3', // Affiliate program deposit
    ]);
    const depositResult2 = await provider.sendAndConfirm(depositTx2);
    console.log('Deposit result', depositResult2);
    expect(typeof depositResult2).toBe('string');

    // Check balance again, should be greater than first deposit
    const userBalanceDeposit2 = await vaultImpl.getUserBalance(mockWallet.publicKey);
    expect(Number(userBalanceDeposit2)).toBeGreaterThan(Number(userBalanceDeposit));

    // Withdraw
    const withdrawTx = await vaultImpl.withdraw(mockWallet.publicKey, userBalanceDeposit2);
    const withdrawResult = await provider.sendAndConfirm(withdrawTx);
    console.log('Withdraw result', withdrawResult);
    expect(typeof withdrawResult).toBe('string');

    // Check final balance to be zero
    const userBalanceDeposit3 = await vaultImpl.getUserBalance(mockWallet.publicKey);
    expect(Number(userBalanceDeposit3)).toEqual(0);
  });

  test('Get affiliate partner info', async () => {
    const partnerInfo = await vaultImpl.getAffiliateInfo();
    expect(Object.keys(partnerInfo)).toEqual(
      expect.arrayContaining(['partnerToken', 'vault', 'outstandingFee', 'feeRatio', 'cummulativeFee']),
    );
  });
});
