import { MangoClient, MANGO_V4_ID } from '@mercurial-finance/mango-v4';
import { AccountRetriever } from '@mercurial-finance/mango-v4/dist/client';
import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AccountMeta, Cluster, Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';

import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { getOrCreateATAInstruction } from '../utils';
import { StrategyHandler, Strategy } from '.';

const MANGO_GROUP_PK = new PublicKey('78b8f4cGCwmZ9ysPFMWLaLTkkaYnUjwMJYStWe5RTSSX');

export default class MangoHandler implements StrategyHandler {
  private cluster: Cluster;
  private connection: Connection;
  private mangoClient: MangoClient;

  constructor(cluster: Cluster, program: VaultProgram) {
    this.cluster = cluster;
    this.mangoClient = MangoClient.connect(program.provider, this.cluster, MANGO_V4_ID[cluster]);
    this.connection = program.provider.connection;
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
    const group = await this.mangoClient.getGroup(MANGO_GROUP_PK);
    await group.reloadAll(this.mangoClient);

    const bank = await group.getFirstBankByMint(vaultState.tokenMint);

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [strategyOwner] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.MANGO), strategyBuffer],
      program.programId,
    );

    const [mangoAccountPK] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.MANGO_ACCOUNT), bank.group.toBuffer(), strategyOwner.toBuffer(), Buffer.from([0, 0, 0, 0])], // Mango account number (0u32)
      this.mangoClient.programId,
    );

    const [tokenAccount, createTokenAccountIx] = await getOrCreateATAInstruction(
      vaultState.tokenMint,
      strategyOwner,
      this.connection,
      {
        payer: walletPubKey,
      },
    );
    createTokenAccountIx && preInstructions.push(createTokenAccountIx);

    const mangoAccount = await this.mangoClient.getMangoAccount(mangoAccountPK);

    const healthRemainingAccounts = await this.mangoClient.buildHealthRemainingAccounts(
      AccountRetriever.Fixed,
      group,
      [mangoAccount],
      [bank],
    );

    const accountData = [
      { pubkey: bank.group },
      { pubkey: mangoAccountPK, isWritable: true },
      { pubkey: strategyOwner },
      { pubkey: bank.vault, isWritable: true },
      { pubkey: bank.oracle },
      { pubkey: tokenAccount, isWritable: true },
      ...healthRemainingAccounts.map((accountPK) => ({
        pubkey: accountPK,
      })),
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accountData) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account?.isWritable,
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
      strategyProgram: this.mangoClient.programId,
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
