import { BN } from "@project-serum/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { STRATEGY_PROGRAM_ADDRESSES } from "../../../constants/vault";
import { StrategyHandler, StrategyType } from "../../../types/vault";
import MangoHandler from "./mango";
import PortWithoutLMHandler from "./portWithoutLM";
import SolendWithoutLMHandler from "./solendWithoutLM";
import VaultHandler from "./vault";

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
