import {
  AccountMeta,
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { TokenInfo, loans } from '@mercurial-finance/frakt-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

import { SEEDS, SOL_MINT } from '../constants';
import { AffiliateVaultProgram, VaultProgram } from '../types';
import { getOrCreateATAInstruction } from '../utils';
import { Strategy, StrategyHandler } from '.';

const FRAKT_PROGRAM_ID = new PublicKey('A66HabVL3DzNzeJgcHYtRRNW1ZRMKwBfrdSR4kLsZ9DJ');
const FRAKT_ADMIN_FEE_PUBKEY = new PublicKey('9aTtUqAnuSMndCpjcPosRNf3fCkrTQAV8C8GERf3tZi3');

export default class FraktHandler implements StrategyHandler {
  private connection: Connection;

  constructor(program: VaultProgram) {
    this.connection = program.provider.connection;
  }

  async withdraw(
    tokenInfo: TokenInfo,
    walletPubKey: PublicKey,
    program: VaultProgram,
    strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    feeVault: PublicKey,
    lpMint: PublicKey,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: BN,
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
  ): Promise<Transaction> {
    if (!walletPubKey) throw new Error('No user wallet public key');

    const { timeBasedLiquidityPools, priceBasedLiquidityPools } = await loans.getAllProgramAccounts(
      FRAKT_PROGRAM_ID,
      this.connection,
    );

    let liquidityPool;
    liquidityPool = timeBasedLiquidityPools.find(
      (pool) => pool.liquidityPoolPubkey === strategy.state.reserve.toBase58(),
    );

    if (!liquidityPool)
      liquidityPool = priceBasedLiquidityPools.find(
        (pool) => pool.liquidityPoolPubkey === strategy.state.reserve.toBase58(),
      );

    if (!liquidityPool) throw new Error('No liquidity pool found');

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const strategyReserveBuffer = new PublicKey(strategy.state.reserve).toBuffer();
    const [collateralVault] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const [strategyOwner] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.FRAKT), strategyBuffer],
      program.programId,
    );

    const [tokenAccount, createTokenAccountIx] = await getOrCreateATAInstruction(
      SOL_MINT,
      strategyOwner,
      this.connection,
      {
        payer: walletPubKey,
      },
    );
    createTokenAccountIx && preInstructions.push(createTokenAccountIx);

    const [deposit] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.DEPOSIT), strategyReserveBuffer, new PublicKey(strategyOwner).toBuffer()],
      FRAKT_PROGRAM_ID,
    );

    const accounts = [
      { pubkey: strategyOwner, isWritable: true },
      { pubkey: tokenAccount, isWritable: true },
      { pubkey: new PublicKey(liquidityPool.liqOwner), isWritable: true },
      { pubkey: deposit, isWritable: true },
      { pubkey: FRAKT_ADMIN_FEE_PUBKEY, isWritable: true },
      { pubkey: SystemProgram.programId },
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

    // prevent duplicate as spot market account pubkey will be add on program side
    const remainingAccountsWithoutReserve = remainingAccounts.filter(
      ({ pubkey }) => !pubkey.equals(strategy.state.reserve),
    );

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: FRAKT_PROGRAM_ID,
      collateralVault,
      feeVault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    if (opt?.affiliate) {
      const tx = await opt.affiliate.affiliateProgram.methods
        .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccountsWithoutReserve)
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
      .accounts({
        ...txAccounts,
        lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccountsWithoutReserve)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
