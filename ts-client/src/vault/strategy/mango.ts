import * as mango from '@blockworks-foundation/mango-client';
import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';

import { StrategyHandler, Strategy } from '.';
import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';

export default class MangoHandler implements StrategyHandler {
  static MangoProgramId = new PublicKey('mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68');
  static MangoGrouPK = new PublicKey('98pjRuQjK3qA6gXts96PqZT4Ze5QmnCmt3QYjhbUSPue');

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
    const [mangoAccountPK] = PublicKey.findProgramAddressSync(
      [MangoHandler.MangoGrouPK.toBuffer(), vault.toBuffer(), Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])],
      MangoHandler.MangoProgramId,
    );
    const mangoClient = new mango.MangoClient(program.provider.connection, MangoHandler.MangoProgramId);
    const rootBankPK = strategy.state.reserve;
    const mangoGroupState = await mangoClient.getMangoGroup(MangoHandler.MangoGrouPK);
    await mangoGroupState.loadRootBanks(program.provider.connection);

    const rootBankIdx = mangoGroupState.getRootBankIndex(new PublicKey(rootBankPK));

    const rootBankState = mangoGroupState.rootBankAccounts[rootBankIdx];
    if (!rootBankState) throw new Error('Root bank state not found');
    const nodeBankPK = rootBankState.nodeBanks[0];

    const nodeBankState = rootBankState.nodeBankAccounts.find((t) => t.publicKey.toBase58() === nodeBankPK.toBase58());
    if (!nodeBankState) throw new Error('Node bank state not found');
    const accountData = [
      { pubkey: MangoHandler.MangoGrouPK, isWritable: true },
      { pubkey: mangoAccountPK, isWritable: true },
      { pubkey: mangoGroupState.mangoCache, isWritable: true },
      { pubkey: nodeBankPK, isWritable: true },
      { pubkey: nodeBankState.vault, isWritable: true },
      { pubkey: mangoGroupState.signerKey, isWritable: true },
      { pubkey: PublicKey.default },
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accountData) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account.isWritable,
        isSigner: false,
      });
    }

    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), new PublicKey(strategy.pubkey).toBuffer()],
      program.programId,
    );

    const txAccounts = {
      vault,
      strategy: strategy.pubkey,
      reserve: strategy.state.reserve,
      strategyProgram: MangoHandler.MangoProgramId,
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
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .remainingAccounts(remainingAccounts)
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: vaultState.lpMint,
          owner: walletPubKey,
        })
        .transaction();
      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(amount, new anchor.BN(0))
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .remainingAccounts(remainingAccounts)
      .accounts({
        ...txAccounts,
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .transaction();
    return tx;
  }
}
