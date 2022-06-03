import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import * as anchor from '@project-serum/anchor';

import { VaultProgram } from '../vault';
import { StrategyHandler } from '.';
import { Strategy } from '../mint';

export default class VaultHandler implements StrategyHandler {
  async withdraw(
    program: VaultProgram,
    _strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    _feeVault: PublicKey,
    lpMint: PublicKey,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: number,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[],
  ): Promise<string> {
    const tx = await program.methods
      .withdraw(new anchor.BN(amount), new anchor.BN(0))
      .accounts({
        vault,
        tokenVault,
        lpMint,
        userToken,
        userLp,
        user: program.provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .rpc({
        maxRetries: 40,
      });

    return tx;
  }
}
