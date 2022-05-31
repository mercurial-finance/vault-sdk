import {
  PublicKey,
  AccountMeta,
  SYSVAR_CLOCK_PUBKEY,
  Cluster,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import * as anchor from "@project-serum/anchor";

import * as port from "@port.finance/port-sdk";

import { ReserveState, StrategyHandler } from ".";
import { VaultProgram } from "../vault";
import { SEEDS } from "../constants";
import { Strategy } from "../mint";

export default class PortWithoutLMHandler implements StrategyHandler {
  constructor(public strategyProgram: PublicKey) {}
  async getReserveState(
    program: VaultProgram,
    reserve: PublicKey
  ): Promise<ReserveState> {
    const account = await program.provider.connection.getAccountInfo(reserve);
    const state = port.ReserveLayout.decode(account!.data) as port.ReserveData;
    return {
      collateral: {
        mintPubkey: state.collateral.mintPubkey,
        mintTotalSupply: Number(state.collateral.mintTotalSupply.toU64()),
        supplyPubkey: state.collateral.supplyPubkey.toString(),
      },
      state,
    };
  }

  async withdraw(
    program: VaultProgram,
    strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    feeVault: PublicKey,
    lpMint: PublicKey,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: number,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[]
  ): Promise<string | undefined> {
    const { state } = await this.getReserveState(
      program,
      strategy.state.reserve
    );
    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();

    let [collateralVault] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId
    );

    const {
      collateral: portCollateral,
      lendingMarket,
      liquidity,
    } = state as port.ReserveData;

    const [lendingMarketAuthority] = await PublicKey.findProgramAddress(
      [lendingMarket.toBuffer()],
      this.strategyProgram
    );

    const accountData = [
      { pubkey: portCollateral.supplyPubkey, isWritable: true },
      { pubkey: lendingMarket },
      { pubkey: lendingMarketAuthority },
      { pubkey: portCollateral.mintPubkey, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY },
    ];
    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accountData) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account.isWritable,
        isSigner: false,
      });
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new anchor.BN(amount), new anchor.BN(0))
      .accounts({
        vault,
        strategy: strategy.pubkey,
        reserve: strategy.state.reserve,
        strategyProgram: this.strategyProgram,
        collateralVault,
        tokenVault,
        feeVault,
        lpMint,
        userToken,
        userLp,
        user: program.provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(
        preInstructions.concat([
          port.refreshReserveInstruction(
            strategy.state.reserve,
            liquidity.oraclePubkey,
            this.strategyProgram
          ),
        ])
      )
      .postInstructions(postInstructions)
      .rpc();

    return tx;
  }
}
