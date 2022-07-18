import { BN } from '@project-serum/anchor';
import { Cluster, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { StrategyProgram } from '../constants';
import type { AffiliateVaultProgram, VaultProgram } from '../types';
import ApricotWithoutLMHandler from './apricotWithoutLM';
import FranciumHandler from './francium';
import MangoHandler from './mango';
import PortWithLMHandler from './portWithLM';
import PortWithoutLMHandler from './portWithoutLM';
import SolendWithLMHandler from './solendWithLM';
import SolendWithoutLMHandler from './solendWithoutLM';
import VaultHandler from './vault';

export type StrategyType =
  | 'portFinanceWithoutLm'
  | 'portFinanceWithLm'
  | 'solendWithoutLm'
  | 'solendWithLm'
  | 'francium'
  | 'apricotWithoutLM'
  | 'mango'
  | 'vault';

export type StrategyState = {
  reserve: PublicKey;
  collateralVault: PublicKey;
  strategyType: object;
  bumps: Uint8Array;
  currentLiquidity: BN;
};

export type Strategy = {
  pubkey: PublicKey;
  state: StrategyState;
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
    postInstructions: TransactionInstruction[],
    opt?: {
      affiliate?: {
        affiliateId: PublicKey;
        affiliateProgram: AffiliateVaultProgram;
        partner: PublicKey;
        user: PublicKey;
      };
    },
  ): Promise<Transaction | { error: string }>;
}

export const getStrategyType = (strategyResponse: any) => {
  return Object.keys(strategyResponse)[0] as StrategyType;
};

export const getStrategyHandler = (
  strategyType: StrategyType,
  cluster: Cluster,
  connection: Connection,
): StrategyHandler | null => {
  const strategyProgramAddresses = StrategyProgram[cluster ?? 'mainnet-beta'];

  switch (strategyType) {
    case 'solendWithoutLm':
      return new SolendWithoutLMHandler(strategyProgramAddresses.solend);
    case 'solendWithLm':
      return new SolendWithLMHandler(strategyProgramAddresses.solend);
    case 'portFinanceWithoutLm':
      return new PortWithoutLMHandler(strategyProgramAddresses.portFinance);
    case 'portFinanceWithLm':
      return new PortWithLMHandler(strategyProgramAddresses.portFinance);
    case 'francium':
      return new FranciumHandler(connection);
    case 'apricotWithoutLM':
      return new ApricotWithoutLMHandler();
    case 'mango':
      return new MangoHandler();
    case 'vault':
      return new VaultHandler();
    default:
      return null;
  }
};
