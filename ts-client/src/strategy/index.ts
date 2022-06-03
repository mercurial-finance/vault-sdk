import { BN } from "@project-serum/anchor";
import { AnchorDefined } from "@saberhq/anchor-contrib";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { STRATEGY_PROGRAM_ADDRESSES } from '../constants';
import type { VaultProgram } from "../vault";
import MangoHandler from "./mango";
import { IDL, Vault as VaultIdl } from "../idl";
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
  ): Promise<string>;
}

export const getStrategyType = (strategyResponse: any) => {
  return Object.keys(strategyResponse)[0] as StrategyType;
};

export const getStrategyHandler = (
  strategyType: StrategyType,
  strategyProgramAddresses: {
    solend: PublicKey;
    portFinance: PublicKey;
  } = STRATEGY_PROGRAM_ADDRESSES
): StrategyHandler | null => { 
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
