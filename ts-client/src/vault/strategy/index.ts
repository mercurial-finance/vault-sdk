import { BN } from "@project-serum/anchor";
import { Cluster } from "@solana/web3.js";
import { StrategyProgram } from "../constants";
import type { StrategyHandler, StrategyType } from "../types/vault";
import MangoHandler from "./mango";
import PortWithoutLMHandler from "./portWithoutLM";
import SolendWithoutLMHandler from "./solendWithoutLM";
import VaultHandler from "./vault";

export const getStrategyType = (strategyResponse: any) => {
  return Object.keys(strategyResponse)[0] as StrategyType;
};

export const getStrategyHandler = (
  strategyType: StrategyType,
  cluster?: Cluster
): StrategyHandler | null => {
  const strategyProgramAddresses = StrategyProgram[cluster ?? "mainnet-beta"];

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
