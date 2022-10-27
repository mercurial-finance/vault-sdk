import {
  PublicKey,
  AccountMeta,
  SYSVAR_CLOCK_PUBKEY,
  Cluster,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import * as quarry from '@quarryprotocol/quarry-sdk';
import { Token } from '@solana/spl-token';
import * as port from '@port.finance/port-sdk';
import { QuarrySDK } from '@quarryprotocol/quarry-sdk';

import { ReserveState, Strategy, StrategyHandler } from '.';
import { AffiliateVaultProgram, VaultProgram } from '../types';
import { REWARDER, SEEDS } from '../constants';

export default class PortWithLMHandler implements StrategyHandler {
  private quarrySDK: quarry.QuarrySDK;
  constructor(public strategyProgram: PublicKey, private allowOwnerOffCurve?: boolean) {
    //@ts-ignore
    this.quarrySDK = QuarrySDK.load({ provider });
  }

  async getReserveState(program: VaultProgram, reserve: PublicKey): Promise<ReserveState> {
    const account = await program.provider.connection.getAccountInfo(reserve);
    const state = port.ReserveLayout.decode(account!.data) as port.ReserveData;
    return {
      collateral: {
        mintPubkey: state.collateral.mintPubkey,
        mintTotalSupply: state.collateral.mintTotalSupply.toU64().toNumber(),
        supplyPubkey: state.collateral.supplyPubkey.toString(),
      },
      state,
    };
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
  ) {
    if (!walletPubKey) throw new Error('No user wallet public key');

    const { state } = await this.getReserveState(program, new PublicKey(strategy.state.reserve));
    const { collateral: portCollateral, lendingMarket, liquidity } = state as port.ReserveData;
    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();

    let [collateralVault] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );
    const rewarder = new PublicKey(REWARDER);

    const [quarryPda] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.QUARRY), rewarder.toBuffer(), portCollateral.mintPubkey.toBuffer()],
      quarry.QUARRY_ADDRESSES.Mine,
    );
    const [miner] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.MINER), quarryPda.toBuffer(), new PublicKey(vault).toBuffer()],
      quarry.QUARRY_ADDRESSES.Mine,
    );

    const minerVault = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      portCollateral.mintPubkey,
      miner,
      this.allowOwnerOffCurve ?? false,
    );

    const [lendingMarketAuthority] = await PublicKey.findProgramAddress(
      [lendingMarket.toBuffer()],
      this.strategyProgram,
    );

    const accountData = [
      { pubkey: liquidity.supplyPubkey, isWritable: true },
      { pubkey: lendingMarket },
      { pubkey: lendingMarketAuthority },
      { pubkey: portCollateral.mintPubkey, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY },
      { pubkey: quarry.QUARRY_ADDRESSES.Mine },
      { pubkey: miner, isWritable: true },
      { pubkey: quarryPda, isWritable: true },
      { pubkey: rewarder, isWritable: true },
      { pubkey: minerVault, isWritable: true },
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accountData) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account.isWritable,
        isSigner: false,
      });
    }

    const updateRewardIx = this.quarrySDK.mine.program.instruction.updateQuarryRewards({
      accounts: {
        rewarder,
        quarry: quarryPda,
      },
    });
    // port.ReserveData.decode liquidity.oraclePubkey null account as a 1111111111111, so we need to convert it back to null
    // when pass to refreshReserveInstruction
    const oracle = PublicKey.default.toBase58() === liquidity.oraclePubkey.toBase58() ? null : liquidity.oraclePubkey;

    const txAccounts = {
      vault,
      strategy: strategy.pubkey,
      reserve: strategy.state.reserve,
      strategyProgram: this.strategyProgram,
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
        .preInstructions(
          preInstructions.concat([
            updateRewardIx,
            port.refreshReserveInstruction(new PublicKey(strategy.state.reserve), oracle),
          ]),
        )
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
      .preInstructions(
        preInstructions.concat([
          updateRewardIx,
          port.refreshReserveInstruction(new PublicKey(strategy.state.reserve), oracle),
        ]),
      )
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
