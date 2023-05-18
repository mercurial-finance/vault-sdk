import { AccountMeta, Cluster, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
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
  getSpotMarketVaultPublicKey,
  Wallet,
} from '@mercurial-finance/drift-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
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

    await this.driftClient.subscribe();

    const spotMarkets = this.cluster === 'devnet' ? DevnetSpotMarkets : MainnetSpotMarkets;
    const spotMarket = spotMarkets.find((market) => market.mint.equals(vaultState.tokenMint));

    if (!spotMarket) throw new Error('Spot market not found');

    await this.driftClient.accountSubscriber.addSpotMarket(spotMarket.marketIndex);

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    // subAccountId is 16 bytes, therefore we slice 2 bytes only
    const subAccountId = new BN(strategy.state.bumps.slice(0, 2), 'le');

    const userPubKey = getUserAccountPublicKeySync(this.programId, vault, subAccountId.toNumber());
    const userStatsPubKey = getUserStatsAccountPublicKey(this.programId, vault);
    const spotMarketVaultPubKey = await getSpotMarketVaultPublicKey(this.programId, spotMarket.marketIndex);
    const driftState = await getDriftStateAccountPublicKey(this.programId);
    const driftSigner = getDriftSignerPublicKey(this.programId);

    const accounts = [
      { pubkey: userPubKey, isWritable: true },
      { pubkey: userStatsPubKey, isWritable: true },
      { pubkey: spotMarketVaultPubKey, isWritable: true },
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
      useMarketLastSlotCache: false,
    });

    remainingAccounts.push(...driftRemainingAccounts);

    // prevent duplicate as spot market account pubkey will be add on program side
    const remainingAccountsWithoutReserve = remainingAccounts.filter(
      ({ pubkey }) => !pubkey.equals(strategy.state.reserve),
    );

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: this.sdkConfig.DRIFT_PROGRAM_ID,
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
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccountsWithoutReserve)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
