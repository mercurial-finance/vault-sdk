import { Program, Provider } from "@project-serum/anchor";
import { TokenInfo } from "@solana/spl-token-registry";
import { PublicKey } from "@solana/web3.js";
import { VaultState } from "../types/vault_state";
import { PROGRAM_ID, SOL_MINT, STRATEGY_PROGRAM_ADDRESSES } from "./constants";
import { IDL, Vault as VaultIdl } from "./idl";
import NativeToken from "./mint/native";
import MintToken from "./mint/token";
import { getStrategyHandler, getStrategyType, StrategyState } from "./strategy";
import { getVaultPdas } from "./utils";

export type VaultProgram = Program<VaultIdl>;
const LOCKED_PROFIT_DEGRATION_DENUMERATOR = 1_000_000_000_000;

class Vault {
  public program: VaultProgram;
  public state: VaultState | null = null;
  public walletPubKey: PublicKey | null = null;

  constructor(provider: Provider, walletPubKey: PublicKey) {
    this.program = new Program<VaultIdl>(IDL as VaultIdl, PROGRAM_ID, provider);
    this.walletPubKey = walletPubKey;
  }

  getTokenProvider(tokenMint: TokenInfo) {
    const isNativeSOL = SOL_MINT.toBase58() === tokenMint.address;
    const provider = isNativeSOL
      ? new NativeToken(this, this.walletPubKey || PublicKey.default)
      : new MintToken(tokenMint, this, this.walletPubKey || PublicKey.default);
    return provider;
  }

  async getVaultStateByMint(tokenMint: PublicKey) {
    const { vaultPda } = await getVaultPdas(tokenMint, this.program.programId);
    const vaultState = (await this.program.account.vault.fetchNullable(
      vaultPda
    )) as VaultState;

    if (!vaultState) {
      throw "Cannot get vault state";
    }

    this.state = vaultState;
  }

  calculateLockedProfit(currentTime) {
    if (!this.state) return 0;

    const duration = currentTime - this.state.lockedProfitTracker.lastReport;
    const lockedProfitDegradation =
      this.state.lockedProfitTracker.lockedProfitDegradation;
    const lockedFundRatio = duration * lockedProfitDegradation;
    if (lockedFundRatio > LOCKED_PROFIT_DEGRATION_DENUMERATOR) {
      return 0;
    }
    const lockedProfit = this.state.lockedProfitTracker.lastUpdatedLockedProfit;
    return Math.floor(
      (lockedProfit * (LOCKED_PROFIT_DEGRATION_DENUMERATOR - lockedFundRatio)) /
        LOCKED_PROFIT_DEGRATION_DENUMERATOR
    );
  }

  getUnlockedAmount(currentTime) {
    if (!this.state) return 0;

    return this.state.totalAmount - this.calculateLockedProfit(currentTime);
  }

  getAmountByShare(currentTime, share, totalSupply) {
    const totalAmount = this.getUnlockedAmount(currentTime);
    return Math.floor((share * totalAmount) / totalSupply);
  }

  getUnmintAmount(currentTime, outToken, totalSupply) {
    const totalAmount = this.getUnlockedAmount(currentTime);
    return Math.floor((outToken * totalSupply) / totalAmount);
  }

  async deposit(tokenMint: TokenInfo, amount: number) {
    const provider = this.getTokenProvider(tokenMint);
    const result = await provider.deposit(amount);
    return result;
  }

  async withdraw(tokenMint: TokenInfo, unmintAmount: number) {
    const provider = this.getTokenProvider(tokenMint);
    const result = await provider.withdraw(unmintAmount);
    return result;
  }

  async withdrawFromStrategy(
    tokenMint: TokenInfo,
    vaultStrategyPubkey: PublicKey,
    unmintAmount: number,
    strategyProgramAddresses: {
      solend: PublicKey;
      portFinance: PublicKey;
    } = STRATEGY_PROGRAM_ADDRESSES
  ) {
    const strategyState = (await this.program.account.strategy.fetchNullable(
      vaultStrategyPubkey
    )) as unknown as StrategyState;
    const tokenProvider = this.getTokenProvider(tokenMint);
    if (strategyState.currentLiquidity.eq(0)) {
      // TODO, must compare currentLiquidity + vaulLiquidity > unmintAmount * virtualPrice
      return;
    }
    const strategy = {
      pubkey: vaultStrategyPubkey,
      state: strategyState,
    };
    const strategyType = getStrategyType(strategyState.strategyType);
    const strategyHandler = getStrategyHandler(
      strategyType,
      strategyProgramAddresses
    );
    if (!strategyType || !strategyHandler) {
      throw new Error('Cannot find strategy handler');
    }

    return await tokenProvider.withdrawFromStrategy(
      strategy,
      strategyHandler,
      unmintAmount
    );
  }
}

export default Vault;
