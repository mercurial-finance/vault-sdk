import { PublicKey, AccountMeta, SYSVAR_CLOCK_PUBKEY, Cluster, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import * as port from '@mercurial-finance/port-sdk';

import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { SEEDS } from '../constants';
import { ReserveState, Strategy, StrategyHandler } from '.';

export default class PortWithoutLMHandler implements StrategyHandler {
  constructor(public strategyProgram: PublicKey) {}
  async getReserveState(program: VaultProgram, reserve: PublicKey): Promise<ReserveState> {
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
    const { state } = await this.getReserveState(program, strategy.state.reserve);
    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();

    let [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const { collateral: portCollateral, lendingMarket, liquidity } = state as port.ReserveData;

    const oraclePubkey = liquidity.oracleOption === 0 ? null : liquidity.oraclePubkey;

    const [lendingMarketAuthority] = PublicKey.findProgramAddressSync([lendingMarket.toBuffer()], this.strategyProgram);

    const accountData = [
      { pubkey: liquidity.supplyPubkey, isWritable: true },
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

    const txAccounts = {
      vault,
      strategy: strategy.pubkey,
      reserve: strategy.state.reserve,
      strategyProgram: this.strategyProgram,
      collateralVault,
      tokenVault,
      feeVault: vaultState.feeVault,
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
          vaultLpMint: vaultState.lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccounts)
        .preInstructions(
          preInstructions.concat([
            port.refreshReserveInstruction(strategy.state.reserve, oraclePubkey, this.strategyProgram),
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
          port.refreshReserveInstruction(strategy.state.reserve, oraclePubkey, this.strategyProgram),
        ]),
      )
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
