import {
  PublicKey,
  Cluster,
  TransactionInstruction,
  Connection,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
  Transaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import FranciumSDK, * as francium from 'francium-sdk';
import * as anchor from '@project-serum/anchor';

import { StrategyHandler, Strategy } from '.';
import { AffiliateVaultProgram, VaultProgram } from '../types';
import { SEEDS } from '../constants';

export default class FranciumHandler implements StrategyHandler {
  private franciumSDK: FranciumSDK;

  constructor(private connection: Connection) {
    this.franciumSDK = new FranciumSDK({
      connection,
    });
  }

  async withdraw(
    walletPubKey: PublicKey,
    program: VaultProgram,
    strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    feeVault: PublicKey,
    lpMint: PublicKey,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: anchor.BN,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[],
    opt?: {
      affiliate?: {
        affiliateId: PublicKey;
        affiliateProgram: AffiliateVaultProgram;
        partner: PublicKey;
        user: PublicKey;
      };
    },
  ): Promise<Transaction | { error: string }> {
    if (!walletPubKey) throw new Error('No user wallet public key');

    const vaultState = await program.account.vault.fetch(vault);
    // https://github.com/Francium-DeFi/francium-sdk/blob/master/src/constants/lend/pools.ts#L59
    const lendingPools = francium.LENDING_CONFIG;
    const lendingPool = Object.values(lendingPools).find((lendingPool) =>
      lendingPool.lendingPoolInfoAccount.equals(new PublicKey(strategy.state.reserve)),
    );
    if (!lendingPool) throw new Error('Cannot find francium lending pool');

    const collateralMint = lendingPool.lendingPoolShareMint;
    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [collateralVault] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const accounts = [
      { pubkey: lendingPool.lendingPoolTknAccount, isWritable: true },
      { pubkey: lendingPool.marketInfoAccount, isWritable: true },
      { pubkey: lendingPool.lendingMarketAuthority },
      { pubkey: collateralMint, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY },
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accounts) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account.isWritable,
        isSigner: false,
      });
    }

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: lendingPool.programId,
      collateralVault,
      feeVault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    if (opt?.affiliate) {
      const tx = await opt.affiliate.affiliateProgram.methods
        .withdrawDirectlyFromStrategy(new anchor.BN(amount), new anchor.BN(0))
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccounts)
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new anchor.BN(amount), new anchor.BN(0))
      .accounts({
        ...txAccounts,
        lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
