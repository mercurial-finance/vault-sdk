import { Wallet } from "@project-serum/anchor";
import {
  TokenInfo,
  StaticTokenListResolutionStrategy,
} from "@solana/spl-token-registry";
import {
  PublicKey,
  TransactionInstruction,
  Connection,
  SYSVAR_CLOCK_PUBKEY,
  ParsedAccountData,
  Transaction,
  Cluster,
} from "@solana/web3.js";
import Decimal from "decimal.js";
import { BN } from "bn.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import {
  VaultImplementation,
  VaultProgram,
  VaultState,
  StrategyState,
  VaultInfo,
  StrategyInfo,
} from "./types/vault";
import {
  deserializeAccount,
  getAssociatedTokenAccount,
  getOrCreateATAInstruction,
  getVaultPdas,
  wrapSOLInstruction,
} from "./utils";
import { PROGRAM_ID, SOL_MINT } from "./constants";
import { getStrategyHandler, getStrategyType } from "./strategy";
import { ParsedClockState } from "./types";

const tokenResolver = new StaticTokenListResolutionStrategy().resolve();

const getOnchainTime = async (connection: Connection) => {
  const parsedClock = await connection.getParsedAccountInfo(
    SYSVAR_CLOCK_PUBKEY
  );

  const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData)
    .parsed as ParsedClockState;

  const currentTime = parsedClockAccount.info.unixTimestamp;
  return currentTime;
};

const getVaultState = async (
  tokenInfo: TokenInfo,
  program: VaultProgram
): Promise<{ vaultPda: PublicKey; vaultState: VaultState }> => {
  const { vaultPda } = await getVaultPdas(
    new PublicKey(tokenInfo.address),
    new PublicKey(PROGRAM_ID)
  );
  const vaultState = (await program.account.vault.fetchNullable(
    vaultPda
  )) as VaultState;

  if (!vaultState) {
    throw "Cannot get vault state";
  }
  return { vaultPda, vaultState };
};

type VaultDetails = VaultState & {
  closestApy: number;
  longApy: number;
  averageApy: number;
  usdRate: number;
  strategies: Array<StrategyInfo>;
};

const LOCKED_PROFIT_DEGRADATION_DENOMINATOR = new Decimal(1_000_000_000_000);
export class VaultImpl implements VaultImplementation {
  private connection: Connection;
  private cluster: Cluster = "mainnet-beta";

  // Vault
  private program: VaultProgram;
  private vaultPda: PublicKey;
  public tokenInfo: TokenInfo;
  public vaultState: VaultDetails;

  private constructor(
    program: VaultProgram,
    {
      tokenInfo,
      vaultPda,
      vaultState,
      vaultInfo: { closest_apy, average_apy, long_apy, usd_rate, strategies },
    },
    opt?: { cluster?: Cluster }
  ) {
    this.connection = program.provider.connection;
    this.cluster = opt?.cluster ?? "mainnet-beta";

    this.program = program;
    this.tokenInfo = tokenInfo;
    this.vaultPda = vaultPda;
    this.vaultState = {
      ...vaultState,
      closestApy: closest_apy,
      longApy: long_apy,
      averageApy: average_apy,
      usdRate: usd_rate,
      strategies,
    };
  }

  public static async create(
    program: VaultProgram,
    vaultInfo: VaultInfo,
    opt?: { cluster?: Cluster }
  ): Promise<VaultImpl> {
    const tokenInfo = tokenResolver.find(
      (token) => token.symbol === vaultInfo.token_address
    );
    if (!tokenInfo) throw new Error("Invalid vault token address");

    const { vaultPda, vaultState } = await getVaultState(tokenInfo, program);
    return new VaultImpl(
      program,
      { tokenInfo, vaultPda, vaultState, vaultInfo },
      opt
    );
  }

  public async getUserBalance(owner: PublicKey): Promise<Decimal> {
    const address = await getAssociatedTokenAccount(
      this.vaultState.lpMint,
      owner
    );
    const accountInfo = await this.connection.getAccountInfo(address);

    if (!accountInfo) {
      return new Decimal(0).toDP(this.tokenInfo.decimals);
    }

    const result = deserializeAccount(accountInfo.data);
    if (result == undefined) {
      throw new Error("Failed to parse user account for LP token.");
    }

    return new Decimal(result.amount.toString()).toDP(this.tokenInfo.decimals);
  }

  public async getVaultSupply(): Promise<Decimal> {
    const context = await this.connection.getTokenSupply(
      this.vaultState.lpMint
    );
    return new Decimal(context.value.amount).toDP(this.tokenInfo.decimals);
  }

  public async getWithdrawableAmount(): Promise<Decimal> {
    const currentTime = await getOnchainTime(this.connection);
    const vaultTotalAmount = new Decimal(
      this.vaultState.totalAmount.toString()
    );

    const {
      lockedProfitTracker: {
        lastReport,
        lockedProfitDegradation,
        lastUpdatedLockedProfit,
      },
    } = this.vaultState;

    const duration = new Decimal(currentTime).sub(lastReport.toString());

    const lockedFundRatio = duration.mul(lockedProfitDegradation.toString());
    if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
      return new Decimal(0);
    }

    const lockedProfit = new Decimal(lastUpdatedLockedProfit.toString())
      .mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio))
      .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR);
    return vaultTotalAmount.sub(lockedProfit);
  }

  private async refreshVaultState() {
    const { vaultPda, vaultState } = await getVaultState(
      this.tokenInfo,
      this.program
    );
    this.vaultPda = vaultPda;
    this.vaultState = {
      ...vaultState,
      ...this.vaultState,
    };
  }

  public async deposit(
    wallet: Wallet,
    baseTokenAmount: Decimal
  ): Promise<Transaction> {
    // Refresh vault state
    await this.refreshVaultState();

    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      wallet.publicKey,
      this.connection
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      wallet.publicKey,
      this.connection
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }
    // If it's SOL vault, wrap desired amount of SOL
    if (new PublicKey(this.tokenInfo.address).equals(SOL_MINT)) {
      preInstructions = preInstructions.concat(
        wrapSOLInstruction(
          wallet.publicKey,
          userToken,
          baseTokenAmount.toNumber()
        )
      );
    }

    const tx = await this.program.methods
      .deposit(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
      .accounts({
        vault: this.vaultPda,
        tokenVault: this.vaultState.tokenVault,
        lpMint: this.vaultState.lpMint,
        userToken,
        userLp: userLpToken,
        user: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .transaction();
    return tx;
  }

  public async withdraw(
    wallet: Wallet,
    baseTokenAmount: Decimal
  ): Promise<Transaction> {
    // Refresh vault state
    await this.refreshVaultState();

    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      wallet.publicKey,
      this.connection
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      wallet.publicKey,
      this.connection
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    const tx = await this.program.methods
      .withdraw(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
      .accounts({
        vault: this.vaultPda,
        tokenVault: this.vaultState.tokenVault,
        lpMint: this.vaultState.lpMint,
        userToken,
        userLp: userLpToken,
        user: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .transaction();
    return tx;
  }

  public async withdrawFromStrategy(
    wallet: Wallet,
    vaultStrategyPubkey: PublicKey,
    baseTokenAmount: Decimal
  ): Promise<Transaction | { error: string }> {
    // Refresh vault state
    await this.refreshVaultState();

    // TODO: Refactor this part, to use strategy class directly
    const strategyState = (await this.program.account.strategy.fetchNullable(
      vaultStrategyPubkey
    )) as unknown as StrategyState;

    if (strategyState.currentLiquidity.eq(new BN(0))) {
      // TODO, must compare currentLiquidity + vaulLiquidity > unmintAmount * virtualPrice
      return { error: "Selected strategy does not have enough liquidity." };
    }

    const strategy = {
      pubkey: vaultStrategyPubkey,
      state: strategyState,
    };
    const strategyType = getStrategyType(strategyState.strategyType);
    const strategyHandler = getStrategyHandler(strategyType, this.cluster);

    if (!strategyType || !strategyHandler) {
      throw new Error("Cannot find strategy handler");
    }

    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      wallet.publicKey,
      this.connection
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      wallet.publicKey,
      this.connection
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    const tx = await strategyHandler.withdraw(
      wallet.publicKey,
      this.program,
      strategy,
      this.vaultPda,
      this.vaultState.tokenVault,
      this.vaultState.feeVault,
      this.vaultState.lpMint,
      userToken,
      userLpToken,
      baseTokenAmount.toNumber(),
      preInstructions,
      []
    );
    return tx;
  }
}
