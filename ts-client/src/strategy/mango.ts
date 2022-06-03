import * as mango from "@blockworks-foundation/mango-client";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountMeta, PublicKey, TransactionInstruction
} from "@solana/web3.js";

import { StrategyHandler } from ".";
import { SEEDS } from "../constants";
import { Strategy } from "../mint";
import { VaultProgram } from "../vault";

export default class MangoHandler implements StrategyHandler {
  static MangoProgramId = new PublicKey(
    "mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68"
  );
  static MangoGrouPK = new PublicKey(
    "98pjRuQjK3qA6gXts96PqZT4Ze5QmnCmt3QYjhbUSPue"
  );

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
  ): Promise<string> {
    const walletPublicKey = program.provider.wallet.publicKey;

    const [mangoAccountPK] = await PublicKey.findProgramAddress(
      [
        MangoHandler.MangoGrouPK.toBuffer(),
        vault.toBuffer(),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
      ],
      MangoHandler.MangoProgramId
    );
    const mangoClient = new mango.MangoClient(
      program.provider.connection,
      MangoHandler.MangoProgramId
    );
    const rootBankPK = strategy.state.reserve;
    const mangoGroupState = await mangoClient.getMangoGroup(
      MangoHandler.MangoGrouPK
    );
    await mangoGroupState.loadRootBanks(program.provider.connection);

    const rootBankIdx = mangoGroupState.getRootBankIndex(
      new PublicKey(rootBankPK)
    );

    const rootBankState = mangoGroupState.rootBankAccounts[rootBankIdx];
    if (!rootBankState) return '';
    const nodeBankPK = rootBankState.nodeBanks[0];

    const nodeBankState = rootBankState.nodeBankAccounts.find(
      (t) => t.publicKey.toBase58() === nodeBankPK.toBase58()
    );
    if (!nodeBankState) return '';
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

    const [collateralVault] = await PublicKey.findProgramAddress(
      [
        Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX),
        new PublicKey(strategy.pubkey).toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new anchor.BN(amount), new anchor.BN(0))
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .remainingAccounts(remainingAccounts)
      .accounts({
        vault,
        strategy: strategy.pubkey,
        reserve: strategy.state.reserve,
        strategyProgram: MangoHandler.MangoProgramId,
        collateralVault,
        feeVault,
        tokenVault,
        lpMint,
        userToken,
        userLp,
        user: walletPublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({
        maxRetries: 40,
      });
    return tx;
  }
}
