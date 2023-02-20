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
} from '@mercurial-finance/cypher-client';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TokenInfo } from '@solana/spl-token-registry';
import BN from 'bn.js';

import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram } from '../types';
import { Strategy, StrategyHandler } from '.';

const PROGRAM_ID = 'CYPH3o83JX6jY6NkbproSpdmQ5VWJtxjfJ5P8veyYVu3';
const CACHE = new PublicKey('6x5U4c41tfUYGEbTXofFiHcfyx3rqJZsT4emrLisNGGL');

export default class CypherHandler implements StrategyHandler {
  private cypherClient: CypherClient;

  constructor(cluster: Cluster, program: VaultProgram) {
    this.cypherClient = new CypherClient(cluster as CypherCluster, program.provider.connection.rpcEndpoint);
  }

  async withdraw(
    tokenInfo: TokenInfo,
    walletPubKey: PublicKey,
    program: VaultProgram,
    strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    feeVault: PublicKey,
    lpMint: PublicKey,
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
    const [collateralVault] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const [strategyOwnerPubkey] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.CYPHER), strategyBuffer],
      program.programId,
    );

    const [clearingPubkey] = derivePublicClearingAddress(this.cypherClient.cypherPID);
    const [masterAccPubkey] = deriveAccountAddress(strategyOwnerPubkey, 0, this.cypherClient.cypherPID);
    const [subAccPubkey] = deriveSubAccountAddress(masterAccPubkey, 0, this.cypherClient.cypherPID);
    const [poolNodePubKey] = derivePoolNodeAddress(strategy.state.reserve, 0, this.cypherClient.cypherPID);
    const [poolTokenVaultPubkey] = derivePoolNodeVaultAddress(poolNodePubKey, this.cypherClient.cypherPID);
    const [vaultSigner] = derivePoolNodeVaultSigner(poolNodePubKey, this.cypherClient.cypherPID);

    const accounts = [
      { pubkey: clearingPubkey },
      { pubkey: CACHE },
      { pubkey: masterAccPubkey, isWritable: true },
      { pubkey: subAccPubkey, isWritable: true },
      { pubkey: poolNodePubKey, isWritable: true },
      { pubkey: poolTokenVaultPubkey, isWritable: true },
      { pubkey: new PublicKey(tokenInfo.address) },
      { pubkey: strategyOwnerPubkey, isWritable: true },
      { pubkey: userToken, isWritable: true },
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

    // prevent duplicate as spot market account pubkey will be add on program side
    const remainingAccountsWithoutReserve = remainingAccounts.filter(
      ({ pubkey }) => !pubkey.equals(strategy.state.reserve),
    );

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: PROGRAM_ID,
      collateralVault,
      feeVault,
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
          vaultLpMint: lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccountsWithoutReserve)
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
      .accounts({
        ...txAccounts,
        lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccountsWithoutReserve)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
