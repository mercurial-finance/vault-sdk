import { AccountMeta, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as apricot from '@mercurial-finance/apricot-sdk';
import * as anchor from '@project-serum/anchor';

import { StrategyHandler, Strategy } from '.';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { SEEDS } from '../constants';

export default class ApricotWithoutLMHandler implements StrategyHandler {
  private address: apricot.Addresses;

  constructor() {
    this.address = new apricot.Addresses(apricot.PUBLIC_CONFIG);
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
  ): Promise<Transaction> {
    if (!walletPubKey) throw new Error('No user wallet public key');

    const [[collateralVault], [userInfoSignerPda]] = await Promise.all(
      [SEEDS.COLLATERAL_VAULT_PREFIX, SEEDS.APRICOT_USER_INFO_SIGNER_PREFIX].map(async (seed) =>
        PublicKey.findProgramAddressSync(
          [Buffer.from(seed), new PublicKey(strategy.pubkey).toBuffer()],
          program.programId,
        ),
      ),
    );

    const [basePda] = await this.address.getBasePda();

    const [userInfo, assetPoolSpl, poolSummaries, priceSummaries, userPageStats] = await Promise.all([
      this.address.getUserInfoKey(userInfoSignerPda),
      this.address.getAssetPoolSplKey(basePda, vaultState.tokenMint.toBase58()),
      this.address.getPoolSummariesKey(),
      this.address.getPriceSummariesKey(basePda),
      this.address.getUserPagesStatsKey(),
    ]);

    const accounts = [
      { pubkey: userInfo },
      { pubkey: assetPoolSpl },
      { pubkey: poolSummaries },
      { pubkey: priceSummaries },
      { pubkey: userInfoSignerPda },
      { pubkey: basePda },
      { pubkey: userPageStats },
    ];

    const remainingAccounts: Array<AccountMeta> = accounts.map((account) => ({
      pubkey: account.pubkey,
      isWritable: true,
      isSigner: false,
    }));

    const txAccounts = {
      vault,
      strategy: strategy.pubkey,
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: this.address.getProgramKey(),
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
          preInstructions.concat(
            // refreshUser Instruction
            new TransactionInstruction({
              programId: this.address.getProgramKey(),
              keys: [
                { pubkey: userInfoSignerPda, isSigner: false, isWritable: false },
                { pubkey: userInfo, isSigner: false, isWritable: true },
                { pubkey: poolSummaries, isSigner: false, isWritable: false },
              ],
              data: Buffer.from([apricot.CMD_REFRESH_USER]),
            }),
          ),
        )
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new anchor.BN(amount), new anchor.BN(0))
      .accounts({
        ...txAccounts,
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(
        preInstructions.concat(
          // refreshUser Instruction
          new TransactionInstruction({
            programId: this.address.getProgramKey(),
            keys: [
              { pubkey: userInfoSignerPda, isSigner: false, isWritable: false },
              { pubkey: userInfo, isSigner: false, isWritable: true },
              { pubkey: poolSummaries, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([apricot.CMD_REFRESH_USER]),
          }),
        ),
      )
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
