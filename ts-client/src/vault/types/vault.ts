import { BN, Program, Wallet } from "@project-serum/anchor";
import {
  IdlTypes,
  TypeDef,
} from "@project-serum/anchor/dist/cjs/program/namespace/types";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import Decimal from "decimal.js";

import { Vault as VaultIdl } from "../idl";

export type VaultProgram = Program<VaultIdl>;

export type VaultState = TypeDef<VaultIdl["accounts"]["0"], IdlTypes<VaultIdl>>;

export type VaultImplementation = {
  getUserBalance: (owner: PublicKey) => Promise<Decimal>;
  getVaultSupply: () => Promise<Decimal>;
  getWithdrawableAmount: (ownerPublicKey: PublicKey) => Promise<Decimal>;
  deposit: (wallet: Wallet, baseTokenAmount: Decimal) => Promise<Transaction>;
  withdraw: (wallet: Wallet, baseTokenAmount: Decimal) => Promise<Transaction>;
  withdrawFromStrategy: (
    wallet: Wallet,
    vaultStrategyPubkey: PublicKey,
    baseTokenAmount: Decimal
  ) => Promise<Transaction | { error: string }>;
};

// API
export type VaultInfo = {
  total_amount: number;
  total_amount_with_profit: number;
  is_monitoring: boolean;
  token_address: string;
  token_amount: number;
  earned_amount: number;
  virtual_price: string;
  closest_apy: number;
  average_apy: number;
  long_apy: number;
  usd_rate: number;
  strategies: Array<StrategyInfo>;
};

export type StrategyInfo = {
  pubkey: string;
  reserve: string;
  strategy_type: StrategyType;
  strategy_name: string;
  liquidity: number;
  reward: number;
  apy: number;
};

export type VaultAPY = {
  closest_apy: {
    strategy: string;
    apy: number;
  };
  average_apy: {
    strategy: string;
    apy: number;
  };
  long_apy: {
    strategy: string;
    apy: number;
  };
};

export type StrategyType =
  | "portFinanceWithoutLm"
  | "solendWithoutLm"
  | "mango"
  | "vault";

export type StrategyState = {
  reserve: PublicKey;
  collateralVault: PublicKey;
  strategyType: object;
  bumps: Uint8Array;
  currentLiquidity: BN;
};

export type ReserveState = {
  collateral: {
    mintPubkey: PublicKey;
    mintTotalSupply: number;
    supplyPubkey: String;
  };
  state: unknown;
};

export interface StrategyHandler {
  strategyProgram?: PublicKey;
  withdraw(
    walletPubKey: PublicKey,
    program: VaultProgram,
    strategy: any,
    vault: PublicKey,
    tokenVault: PublicKey,
    feeVault: PublicKey,
    lpMint: PublicKey,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: number,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[]
  ): Promise<Transaction | { error: string }>;
}

export type Strategy = {
  pubkey: PublicKey;
  state: StrategyState;
};
