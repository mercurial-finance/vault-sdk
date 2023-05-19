import { AccountMeta, PublicKey, SYSVAR_CLOCK_PUBKEY, TransactionInstruction } from '@solana/web3.js';
import * as solend from '@mercurial-finance/solend-sdk';
import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { SEEDS } from '../constants';
import { ReserveState, StrategyHandler, Strategy } from '.';

// not using now
export default class SolendWithLMHandler implements StrategyHandler {
  constructor(public strategyProgram: PublicKey) {}

  async getReserveState(program: VaultProgram, reserve: PublicKey): Promise<ReserveState> {
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
    vaultState: VaultState,
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
    const { collateral, state } = await this.getReserveState(program, strategy.state.reserve);
    let [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), new PublicKey(strategy.pubkey).toBuffer()],
      program.programId,
    );

    const { liquidity, lendingMarket } = state as solend.Reserve;

    const [lendingMarketAuthority] = PublicKey.findProgramAddressSync([lendingMarket.toBuffer()], this.strategyProgram);

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
      throw new Error('Incorrect pythOracle or switchboardOracle pubkey');
    }

    const txAccounts = {
      vault,
      strategy: strategy.pubkey,
      reserve: strategy.state.reserve,
      strategyProgram: this.strategyProgram,
      collateralVault,
      feeVault: vaultState.feeVault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    if (opt?.affiliate) {
      const tx = await opt.affiliate.affiliateProgram.methods
        .withdrawDirectlyFromStrategy(amount, new anchor.BN(0))
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: vaultState.lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccounts)
        .preInstructions(
          preInstructions.concat([
            solend.refreshReserveInstruction(
              strategy.state.reserve,
              this.strategyProgram,
              pythOracle,
              switchboardOracle,
            ),
          ]),
        )
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(amount, new anchor.BN(0))
      .accounts({
        ...txAccounts,
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(
        preInstructions.concat([
          solend.refreshReserveInstruction(strategy.state.reserve, this.strategyProgram, pythOracle, switchboardOracle),
        ]),
      )
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
