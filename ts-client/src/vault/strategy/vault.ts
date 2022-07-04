import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import * as anchor from '@project-serum/anchor';

import { StrategyHandler } from '.';
import { Strategy } from '../../mint';
import { VaultProgram } from '../types';

export default class VaultHandler implements StrategyHandler {
  async withdraw(
    walletPubKey: PublicKey,
    program: VaultProgram,
    _strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    _feeVault: PublicKey,
    lpMint: PublicKey,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: anchor.BN,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[],
  ) {
    const tx = await program.methods
      .withdraw(amount, new anchor.BN(0))
      .accounts({
        vault,
        tokenVault,
        lpMint,
        userToken,
        userLp,
        user: walletPubKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
