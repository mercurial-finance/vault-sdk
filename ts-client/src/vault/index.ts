import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import { PublicKey, TransactionInstruction, Connection, Transaction, Cluster, SYSVAR_RENT_PUBKEY, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TokenInfo } from '@solana/spl-token-registry';

import { AffiliateVaultProgram, VaultDetails, VaultImplementation, VaultProgram, VaultState } from './types';
import {
  deserializeAccount,
  getAssociatedTokenAccount,
  getLpSupply,
  getOnchainTime,
  getOrCreateATAInstruction,
  getVaultPdas,
  unwrapSOLInstruction,
  wrapSOLInstruction,
} from './utils';
import { AFFILIATE_PROGRAM_ID, LOCKED_PROFIT_DEGRADATION_DENOMINATOR, PROGRAM_ID, SOL_MINT, VAULT_STRATEGY_ADDRESS } from './constants';
import { getStrategyHandler, getStrategyType, StrategyState } from './strategy';
import { IDL, Vault as VaultIdl } from './idl';
import { IDL as AffiliateIDL, AffiliateVault as AffiliateVaultIdl } from './affiliate-idl';

const getVaultState = async (
  vaultParams: TokenInfo,
  program: VaultProgram,
): Promise<{ vaultPda: PublicKey; tokenVaultPda: PublicKey; vaultState: VaultState; lpSupply: BN }> => {
  const { vaultPda, tokenVaultPda } = await getVaultPdas(
    new PublicKey(vaultParams.address),
    new PublicKey(program.programId),
  );
  const vaultState = (await program.account.vault.fetchNullable(vaultPda)) as VaultState;
  const lpSupply = await getLpSupply(program.provider.connection, vaultState.lpMint);

  if (!vaultState) {
    throw 'Cannot get vault state';
  }
  return { vaultPda, tokenVaultPda, vaultState, lpSupply };
};

const getVaultLiquidity = async (connection: Connection, tokenVaultPda: PublicKey): Promise<string | null> => {
  const vaultLiquidityResponse = await connection.getAccountInfo(tokenVaultPda);
  if (!vaultLiquidityResponse) return null;

  const vaultLiquiditySerialize = deserializeAccount(vaultLiquidityResponse.data);
  return vaultLiquiditySerialize?.amount.toString() || null;
};

export default class VaultImpl implements VaultImplementation {
  private connection: Connection;
  private cluster: Cluster = 'mainnet-beta';

  // Vault
  private program: VaultProgram;
  private affiliateId: PublicKey | undefined;
  private affiliateProgram: AffiliateVaultProgram | undefined;

  public tokenInfo: TokenInfo;
  public vaultPda: PublicKey;
  public tokenVaultPda: PublicKey;
  public vaultState: VaultState;
  public lpSupply: BN = new BN(0);

  private constructor(
    program: VaultProgram,
    vaultDetails: VaultDetails,
    opt?: {
      cluster?: Cluster,
      affiliateId?: PublicKey,
      affiliateProgram?: AffiliateVaultProgram
    }
  ) {
    this.connection = program.provider.connection;
    this.cluster = opt?.cluster ?? 'mainnet-beta';

    this.tokenInfo = vaultDetails.tokenInfo;
    this.program = program;
    this.affiliateProgram = opt?.affiliateProgram;
    this.affiliateId = opt?.affiliateId;

    this.vaultPda = vaultDetails.vaultPda;
    this.tokenVaultPda = vaultDetails.tokenVaultPda;
    this.vaultState = vaultDetails.vaultState;
    this.lpSupply = vaultDetails.lpSupply;
  }

  public static async create(
    connection: Connection,
    tokenInfo: TokenInfo,
    opt?: {
      cluster?: Cluster;
      programId?: string;
      affiliateId?: PublicKey;
      affiliateProgramId?: string;
    },
  ): Promise<VaultImpl> {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
    const program = new Program<VaultIdl>(IDL as VaultIdl, opt?.programId || PROGRAM_ID, provider);

    const { vaultPda, tokenVaultPda, vaultState, lpSupply } = await getVaultState(tokenInfo, program);
    return new VaultImpl(
      program,
      { tokenInfo, vaultPda, tokenVaultPda, vaultState, lpSupply },
      {
        ...opt,
        affiliateId: opt?.affiliateId,
        affiliateProgram: opt?.affiliateId
          ? new Program<AffiliateVaultIdl>(
            AffiliateIDL as AffiliateVaultIdl,
            opt?.affiliateProgramId || AFFILIATE_PROGRAM_ID,
            provider
          )
          : undefined
      }
    );
  }

  public async getUserBalance(owner: PublicKey): Promise<BN> {
    const address = await getAssociatedTokenAccount(this.vaultState.lpMint, owner);
    const accountInfo = await this.connection.getAccountInfo(address);

    if (!accountInfo) {
      return new BN(0);
    }

    const result = deserializeAccount(accountInfo.data);
    if (result == undefined) {
      throw new Error('Failed to parse user account for LP token.');
    }

    return new BN(result.amount);
  }

  /** To refetch the latest lpSupply */
  /** Use vaultImpl.lpSupply to use cached result */
  public async getVaultSupply(): Promise<BN> {
    const lpSupply = await getLpSupply(this.connection, this.vaultState.lpMint);
    this.lpSupply = lpSupply;
    return lpSupply;
  }

  public async getWithdrawableAmount(): Promise<BN> {
    const currentTime = await getOnchainTime(this.connection);
    const vaultTotalAmount = this.vaultState.totalAmount;

    const {
      lockedProfitTracker: { lastReport, lockedProfitDegradation, lastUpdatedLockedProfit },
    } = this.vaultState;

    const duration = new BN(currentTime).sub(lastReport);

    const lockedFundRatio = duration.mul(lockedProfitDegradation);
    if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
      return new BN(0);
    }

    const lockedProfit = lastUpdatedLockedProfit
      .mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio))
      .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR);

    return vaultTotalAmount.sub(lockedProfit);
  }

  private async refreshVaultState() {
    const { vaultPda, tokenVaultPda, vaultState } = await getVaultState(this.tokenInfo, this.program);
    this.vaultPda = vaultPda;
    this.tokenVaultPda = tokenVaultPda;
    this.vaultState = vaultState;
  }

  private async createATAPreInstructions(owner: PublicKey) {
    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      owner,
      this.connection,
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      owner,
      this.connection,
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    return {
      preInstructions,
      userToken,
      userLpToken,
    };
  }

  private async createAffiliateATAPreInstructions(owner: PublicKey) {
    if (!this.affiliateId || !this.affiliateProgram) throw new Error('Affiliate ID or program not found');

    const partner = this.affiliateId;
    const partnerToken = await getAssociatedTokenAccount(
      new PublicKey(this.tokenInfo.address),
      partner,
    );

    const [partnerAddress, _nonce] = await PublicKey.findProgramAddress(
      [this.vaultPda.toBuffer(), partnerToken.toBuffer()],
      this.affiliateProgram.programId
    );
    const [userAddress, _nonceUser] = await PublicKey.findProgramAddress(
      [partnerAddress.toBuffer(), owner.toBuffer()],
      this.affiliateProgram.programId,
    );

    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      owner,
      this.connection,
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      userAddress,
      this.connection,
      {
        payer: owner,
        allowOwnerOffCurve: true,
      }
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    return {
      preInstructions,
      partner,
      partnerAddress,
      userAddress,
      userToken,
      userLpToken,
    };
  }

  public async deposit(owner: PublicKey, baseTokenAmount: BN): Promise<Transaction> {
    // Refresh vault state
    await this.refreshVaultState();

    let preInstructions: TransactionInstruction[] = [];

    let partnerAddress: PublicKey | undefined;
    let userAddress: PublicKey | undefined;
    let userToken: PublicKey | undefined;
    let userLpToken: PublicKey | undefined;

    // Withdraw with Affiliate
    if (this.affiliateId && this.affiliateProgram) {
      const { preInstructions: preInstructionsATA, partnerAddress: partnerAddressATA, userAddress: userAddressATA, userToken: userTokenATA, userLpToken: userLpTokenATA } = await this.createAffiliateATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
      partnerAddress = partnerAddressATA;
      userAddress = userAddressATA;
    } else {
      // Without affiliate
      const { preInstructions: preInstructionsATA, userToken: userTokenATA, userLpToken: userLpTokenATA } = await this.createATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
    }

    // If it's SOL vault, wrap desired amount of SOL
    if (this.tokenInfo.address === SOL_MINT.toString()) {
      preInstructions = preInstructions.concat(wrapSOLInstruction(owner, userToken, baseTokenAmount));
    }

    let depositTx: Transaction;
    if (partnerAddress && userAddress && this.affiliateId && this.affiliateProgram) {
      const userPda = await this.connection.getParsedAccountInfo(userAddress);
      if (!userPda || !userPda.value?.data) {
        // Init first time user
        preInstructions.push(
          await this.affiliateProgram.methods
            .initUser()
            .accounts({
              user: userAddress,
              partner: partnerAddress,
              owner,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction()
        )
      }

      depositTx = await this.affiliateProgram.methods
        .deposit(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          partner: partnerAddress,
          user: userAddress,
          vaultProgram: this.program.programId,
          vault: this.vaultPda,
          tokenVault: this.tokenVaultPda,
          vaultLpMint: this.vaultState.lpMint,
          userToken,
          userLp: userLpToken,
          owner,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .transaction()
    } else {
      depositTx = await this.program.methods
        .deposit(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          vault: this.vaultPda,
          tokenVault: this.tokenVaultPda,
          lpMint: this.vaultState.lpMint,
          userToken,
          userLp: userLpToken,
          user: owner,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .transaction()
    }
    return new Transaction({ feePayer: owner, ...(await this.connection.getLatestBlockhash()) }).add(depositTx);
  }

  private async getStrategyWithHighestLiquidity(strategy?: PublicKey) {
    // Reserved for testing
    if (strategy) {
      const strategyState = (await this.program.account.strategy.fetchNullable(strategy)) as unknown as StrategyState;
      return { publicKey: strategy, strategyState };
    }

    const vaultStrategiesStatePromise = this.vaultState.strategies
      .filter((address) => address.toString() !== VAULT_STRATEGY_ADDRESS)
      .map(async (strat) => {
        const strategyState = (await this.program.account.strategy.fetchNullable(strat)) as unknown as StrategyState;
        return { publicKey: strat, strategyState };
      });
    const vaultStrategiesState = await Promise.allSettled(vaultStrategiesStatePromise);

    const highestLiquidity = vaultStrategiesState
      .map((item) => (item.status === 'fulfilled' ? item.value : undefined))
      .sort((a, b) => {
        if (a && b) {
          return b.strategyState.currentLiquidity.sub(a.strategyState.currentLiquidity).toNumber();
        }
        return 0;
      })[0];
    return highestLiquidity
      ? highestLiquidity
      : {
        publicKey: new PublicKey(VAULT_STRATEGY_ADDRESS),
        strategyState: null,
      };
  }

  public async withdraw(owner: PublicKey, baseTokenAmount: BN, opt?: { strategy?: PublicKey }): Promise<Transaction> {
    // Refresh vault state
    await this.refreshVaultState();

    // Get strategy with highest liquidity
    // opt.strategy reserved for testing
    const selectedStrategy = await this.getStrategyWithHighestLiquidity(opt?.strategy);
    if (
      !selectedStrategy || // If there's no strategy deployed to the vault, use Vault Reserves instead
      selectedStrategy.publicKey.toString() === VAULT_STRATEGY_ADDRESS || // If opt.strategy specified Vault Reserves
      !selectedStrategy.strategyState // If opt.strategy specified Vault Reserves
    ) {
      return this.withdrawFromVaultReserve(owner, baseTokenAmount);
    }

    const currentLiquidity = new BN(selectedStrategy.strategyState.currentLiquidity);
    const vaultLiquidty = new BN((await getVaultLiquidity(this.connection, this.tokenVaultPda)) || 0);
    const unlockedAmount = await this.getWithdrawableAmount();
    const virtualPrice = new BN(unlockedAmount).div(new BN(this.lpSupply));

    const availableAmount = currentLiquidity.add(vaultLiquidty);
    const amountToUnmint = new BN(baseTokenAmount).mul(virtualPrice);
    if (amountToUnmint.gt(availableAmount)) {
      throw new Error('Selected strategy does not have enough liquidity.');
    }

    const strategyType = getStrategyType(selectedStrategy.strategyState.strategyType);
    const strategyHandler = getStrategyHandler(strategyType, this.cluster, this.connection);

    if (!strategyType || !strategyHandler) {
      throw new Error('Cannot find strategy handler');
    }

    let preInstructions: TransactionInstruction[] = [];
    let withdrawOpt = {};
    let userToken: PublicKey | undefined;
    let userLpToken: PublicKey | undefined;

    // Withdraw with Affiliate
    if (this.affiliateId && this.affiliateProgram) {
      const { preInstructions: preInstructionsATA, partnerAddress, userAddress, userToken: userTokenATA, userLpToken: userLpTokenATA } = await this.createAffiliateATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      withdrawOpt = {
        affiliate: {
          affiliateId: this.affiliateId,
          affiliateProgram: this.affiliateProgram,
          partner: partnerAddress,
          user: userAddress,
        }
      }
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
    } else {
      // Without affiliate
      const { preInstructions: preInstructionsATA, userToken: userTokenATA, userLpToken: userLpTokenATA } = await this.createATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
    }

    // Unwrap SOL
    const postInstruction: Array<TransactionInstruction> = [];
    if (this.tokenInfo.address === SOL_MINT.toString()) {
      const closeWrappedSOLIx = await unwrapSOLInstruction(owner);
      if (closeWrappedSOLIx) {
        postInstruction.push(closeWrappedSOLIx);
      }
    }

    const withdrawFromStrategyTx = await strategyHandler.withdraw(
      owner,
      this.program,
      {
        pubkey: selectedStrategy.publicKey,
        state: selectedStrategy.strategyState,
      },
      this.vaultPda,
      this.tokenVaultPda,
      this.vaultState.feeVault,
      this.vaultState.lpMint,
      userToken,
      userLpToken,
      baseTokenAmount,
      preInstructions,
      postInstruction,
      withdrawOpt,
    );

    if (withdrawFromStrategyTx instanceof Transaction) {
      return new Transaction({ feePayer: owner, ...(await this.connection.getLatestBlockhash()) }).add(
        withdrawFromStrategyTx,
      );
    }

    // Return error
    throw new Error(withdrawFromStrategyTx.error);
  }

  // Reserved code to withdraw from Vault Reserves directly.
  // The only situation this piece of code will be required, is when a single Vault have no other strategy, and only have its own reserve.
  private async withdrawFromVaultReserve(owner: PublicKey, baseTokenAmount: BN): Promise<Transaction> {
    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      owner,
      this.connection,
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      owner,
      this.connection,
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    // Unwrap SOL
    const postInstruction: Array<TransactionInstruction> = [];
    if (this.tokenInfo.address === SOL_MINT.toString()) {
      const closeWrappedSOLIx = await unwrapSOLInstruction(owner);
      if (closeWrappedSOLIx) {
        postInstruction.push(closeWrappedSOLIx);
      }
    }

    const withdrawTx = await this.program.methods
      .withdraw(baseTokenAmount, new BN(0)) // Vault does not have slippage, second parameter is ignored.
      .accounts({
        vault: this.vaultPda,
        tokenVault: this.tokenVaultPda,
        lpMint: this.vaultState.lpMint,
        userToken,
        userLp: userLpToken,
        user: owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .postInstructions(postInstruction)
      .transaction();

    return new Transaction({ feePayer: owner, ...(await this.connection.getLatestBlockhash()) }).add(withdrawTx);
  }
}
