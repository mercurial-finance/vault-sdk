import { AccountMeta, Cluster, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  CypherClient,
  Cluster as CypherCluster,
  derivePublicClearingAddress,
  deriveAccountAddress,
  deriveSubAccountAddress,
  derivePoolNodeAddress,
  derivePoolNodeVaultAddress,
  derivePoolNodeVaultSigner,
  CONFIGS,
} from '@mercurial-finance/cypher-client';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { getOrCreateATAInstruction } from '../utils';
import { Strategy, StrategyHandler } from '.';

export default class CypherHandler implements StrategyHandler {
  private cypherClient: CypherClient;
  private cluster: CypherCluster;
  private program: VaultProgram;

  constructor(cluster: Cluster, program: VaultProgram) {
    this.cluster = cluster as CypherCluster;
    this.program = program;
    this.cypherClient = new CypherClient(cluster as CypherCluster, program.provider.connection.rpcEndpoint);
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
    amount: BN,
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

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const [strategyOwnerPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.CYPHER), strategyBuffer],
      program.programId,
    );

    const [strategyOwnerATA] = await getOrCreateATAInstruction(
      vaultState.tokenMint,
      strategyOwnerPubkey,
      this.program.provider.connection,
    );

    const [clearingPubkey] = derivePublicClearingAddress(this.cypherClient.cypherPID);
    const [masterAccPubkey] = deriveAccountAddress(strategyOwnerPubkey, 0, this.cypherClient.cypherPID);
    const [subAccPubkey] = deriveSubAccountAddress(masterAccPubkey, 0, this.cypherClient.cypherPID);
    const [poolNodePubKey] = derivePoolNodeAddress(strategy.state.reserve, 0, this.cypherClient.cypherPID);
    const [poolTokenVaultPubkey] = derivePoolNodeVaultAddress(poolNodePubKey, this.cypherClient.cypherPID);
    const [vaultSigner] = derivePoolNodeVaultSigner(poolNodePubKey, this.cypherClient.cypherPID);

    const accounts = [
      { pubkey: clearingPubkey },
      { pubkey: CONFIGS[this.cluster].CACHE },
      { pubkey: masterAccPubkey, isWritable: true },
      { pubkey: subAccPubkey, isWritable: true },
      { pubkey: poolNodePubKey, isWritable: true },
      { pubkey: poolTokenVaultPubkey, isWritable: true },
      { pubkey: vaultState.tokenMint },
      { pubkey: strategyOwnerPubkey, isWritable: true },
      { pubkey: strategyOwnerATA, isWritable: true },
      { pubkey: vaultSigner, isWritable: true },
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accounts) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account.isWritable,
        isSigner: false,
      });
    }

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: this.cypherClient.cypherPID,
      collateralVault,
      feeVault: vaultState.feeVault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    if (opt?.affiliate) {
      const tx = await opt.affiliate.affiliateProgram.methods
        .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: vaultState.lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccounts)
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
      .accounts({
        ...txAccounts,
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
