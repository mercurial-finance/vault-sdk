import {
  AccountMeta,
  Cluster,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  DriftClient,
  DriftConfig,
  initialize,
  MainnetSpotMarkets,
  DevnetSpotMarkets,
  getUserStatsAccountPublicKey,
  getUserAccountPublicKeySync,
  getDriftStateAccountPublicKey,
  getDriftSignerPublicKey,
  getSpotMarketPublicKey,
} from '@mercurial-finance/drift-sdk';
import { Wallet } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TokenInfo } from '@solana/spl-token-registry';
import BN from 'bn.js';

import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram } from '../types';
import { Strategy, StrategyHandler } from '.';

export default class DriftHandler implements StrategyHandler {
  private sdkConfig: DriftConfig;
  private driftClient: DriftClient;
  private cluster: Cluster;
  private programId: PublicKey;

  constructor(cluster: Cluster, program: VaultProgram) {
    this.sdkConfig = initialize({ env: cluster === 'testnet' ? 'mainnet-beta' : cluster });
    this.cluster = cluster;
    this.driftClient = new DriftClient({
      connection: program.provider.connection,
      programID: new PublicKey(this.sdkConfig.DRIFT_PROGRAM_ID),
      wallet: new Wallet(Keypair.generate()),
    });
    this.programId = new PublicKey(this.sdkConfig.DRIFT_PROGRAM_ID);
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

    const spotMarkets = this.cluster === 'devnet' ? DevnetSpotMarkets : MainnetSpotMarkets;
    const spotMarket = spotMarkets.find((market) => market.mint.toBase58() === tokenInfo.address);

    if (!spotMarket) throw new Error('Spot market not found');

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [collateralVault] = await PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const userPubKey = getUserAccountPublicKeySync(this.programId, vault);
    const userStatsPubKey = getUserStatsAccountPublicKey(this.programId, vault);
    const spotMarketPubKey = await getSpotMarketPublicKey(this.programId, spotMarket.marketIndex);
    const driftState = await getDriftStateAccountPublicKey(this.programId);
    const driftSigner = getDriftSignerPublicKey(this.programId);

    const accounts = [
      { pubkey: userPubKey, isWritable: true },
      { pubkey: userStatsPubKey, isWritable: true },
      { pubkey: spotMarketPubKey, isWritable: true },
      { pubkey: driftState },
      { pubkey: driftSigner },
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accounts) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: !!account.isWritable,
        isSigner: false,
      });
    }

    const driftRemainingAccounts = this.driftClient.getRemainingAccounts({
      userAccounts: [],
      writableSpotMarketIndexes: [spotMarket.marketIndex],
    });

    remainingAccounts.push(...driftRemainingAccounts);

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: this.sdkConfig.DRIFT_PROGRAM_ID,
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
        lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
