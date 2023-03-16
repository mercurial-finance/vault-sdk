import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';

import { StrategyHandler, Strategy } from '.';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';

export default class VaultHandler implements StrategyHandler {
  async withdraw(
    walletPubKey: PublicKey,
    program: VaultProgram,
    _strategy: Strategy,
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
    const txAccounts = {
      vault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    if (opt?.affiliate) {
      const tx = await opt.affiliate.affiliateProgram.methods
        .withdraw(amount, new anchor.BN(0))
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: vaultState.lpMint,
          owner: walletPubKey,
        })
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdraw(amount, new anchor.BN(0))
      .accounts({
        ...txAccounts,
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
