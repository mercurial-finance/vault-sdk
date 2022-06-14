import {
  AccountMeta,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import * as solend from "@solendprotocol/solend-sdk";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { VaultProgram } from "../vault";
import { ReserveState, StrategyHandler } from ".";
import { SEEDS } from "../constants";
import { Strategy } from "../mint";

// not using now
export default class SolendWithLMHandler implements StrategyHandler {
  constructor(public strategyProgram: PublicKey) {}

  async getReserveState(
    program: VaultProgram,
    reserve: PublicKey
  ): Promise<ReserveState> {
    const state = await (async () => {
      const account = await program.provider.connection.getAccountInfo(reserve);

      const solendParse = solend.parseReserve(account!.owner, account!);
      return solendParse!.info;
    })();

    return {
      collateral: {
        mintPubkey: state.collateral.mintPubkey,
        mintTotalSupply: state.collateral.mintTotalSupply.toNumber(),
        supplyPubkey: state.collateral.mintTotalSupply.toString(),
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
    amount: number,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[]
  ): Promise<string> {
    const { collateral, state } = await this.getReserveState(
      program,
      strategy.state.reserve
    );
    let [collateralVault] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX),
        new PublicKey(strategy.pubkey).toBuffer(),
      ],
      program.programId
    );

    const { liquidity, lendingMarket } = state as solend.Reserve;

    const [lendingMarketAuthority] = await PublicKey.findProgramAddress(
      [lendingMarket.toBuffer()],
      this.strategyProgram
    );

    const accounts = [
      { pubkey: liquidity.supplyPubkey, isWritable: true },
      { pubkey: lendingMarket },
      { pubkey: lendingMarketAuthority },
      { pubkey: collateral.mintPubkey, isWritable: true },
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
    const { pythOracle, switchboardOracle } = liquidity as unknown as {
      pythOracle?: PublicKey;
      switchboardOracle?: PublicKey;
    };

    if (!pythOracle || !switchboardOracle) {
      throw new Error("Incorrect pythOracle or switchboardOracle pubkey");
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
        user: walletPubKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(
        preInstructions.concat([
          solend.refreshReserveInstruction(
            strategy.state.reserve,
            this.strategyProgram,
            pythOracle,
            switchboardOracle
          ),
        ])
      )
      .postInstructions(postInstructions)
      .rpc();

    return tx;
  }
}
