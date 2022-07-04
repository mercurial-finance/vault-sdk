import { BN } from "@project-serum/anchor";
import { Cluster, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { StrategyProgram } from '../constants';
import type { VaultProgram } from "../types";
import MangoHandler from "./mango";
import PortWithoutLMHandler from "./portWithoutLM";
import SolendWithoutLMHandler from "./solendWithoutLM";
import VaultHandler from "./vault";

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
    amount: BN,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[]
  ): Promise<Transaction | { error: string }>;
}

export const getStrategyType = (strategyResponse: any) => {
  return Object.keys(strategyResponse)[0] as StrategyType;
};

export const getStrategyHandler = (strategyType: StrategyType, cluster?: Cluster): StrategyHandler | null => { 
  const strategyProgramAddresses = StrategyProgram[cluster ?? 'mainnet-beta']

  switch (strategyType) {
    case "solendWithoutLm":
      return new SolendWithoutLMHandler(strategyProgramAddresses.solend);
    case "portFinanceWithoutLm":
      return new PortWithoutLMHandler(strategyProgramAddresses.portFinance);
    case "mango":
      return new MangoHandler();
    case "vault":
      return new VaultHandler();
    default:
      return null;
  }
};
