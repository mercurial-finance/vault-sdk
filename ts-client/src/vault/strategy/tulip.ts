import {
    PublicKey,
    TransactionInstruction,
    SYSVAR_CLOCK_PUBKEY,
    AccountMeta,
    Transaction,
  } from '@solana/web3.js';
  import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
  import * as tulip from '@mercurial-finance/tulip-platform-sdk';
  import * as anchor from '@project-serum/anchor';
  
  import { StrategyHandler, Strategy } from '.';
  import { AffiliateVaultProgram, VaultProgram } from '../types';
  import { SEEDS } from '../constants';
  
  export default class TulipHandler implements StrategyHandler {
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
  
      // https://github.com/Francium-DeFi/francium-sdk/blob/master/src/constants/lend/pools.ts#L59
      const lendingPools = tulip.LENDING_RESERVES;
      const lendingPool = Object.values(lendingPools).find((lendingPool: any) =>
        lendingPool.account === strategy.state.reserve.toBase58()
      );
      if (!lendingPool) throw new Error('Cannot find francium lending pool');
  
      const collateralMint = lendingPool.collateralTokenMint;
      const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
      const [collateralVault] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
        program.programId,
      );

      const [derivedLendingMarketAuthority] =
      await anchor.web3.PublicKey.findProgramAddress(
        [new anchor.web3.PublicKey(tulip.getLendingMarketAccount()).toBytes()],
        tulip.LENDING_PROGRAM_ID
      );
  
      const accounts = [
        { pubkey: lendingPool.liquiditySupplyTokenAccount, isWritable: true },
        { pubkey: tulip.getLendingMarketAccount(), isWritable: true },
        { pubkey: derivedLendingMarketAuthority },
        { pubkey: collateralMint, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY },
      ];
  
      const remainingAccounts: Array<AccountMeta> = [];
      for (const account of accounts) {
        remainingAccounts.push({
          pubkey: new PublicKey(account.pubkey),
          isWritable: !!account.isWritable,
          isSigner: false,
        });
      }
  
      const txAccounts = {
        vault,
        strategy: new PublicKey(strategy.pubkey),
        reserve: new PublicKey(strategy.state.reserve),
        strategyProgram: tulip.LENDING_PROGRAM_ID,
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
  