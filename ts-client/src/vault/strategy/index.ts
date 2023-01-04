import { BN } from '@project-serum/anchor';
import { Cluster, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TokenInfo } from '@solana/spl-token-registry';

import { StrategyProgram } from '../constants';
import type { AffiliateVaultProgram, VaultProgram } from '../types';
import ApricotWithoutLMHandler from './apricotWithoutLM';
import FranciumHandler from './francium';
import MangoHandler from './mango';
import TulipHandler from './tulip';
import DriftHandler from './drift';
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
  | 'tulip'
  | 'vault'
  | 'drift';

export type StrategyState = {
  reserve: PublicKey;
  collateralVault: PublicKey;
  strategyType: object;
  bumps: Uint8Array;
  currentLiquidity: BN;
  vault: PublicKey;
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
    tokenInfo: TokenInfo,
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
  ): Promise<Transaction>;
}

export const getStrategyType = (strategyResponse: any) => {
  return Object.keys(strategyResponse)[0] as StrategyType;
};

export const getStrategyHandler = (
  strategyType: StrategyType,
  cluster: Cluster,
  program: VaultProgram,
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
      return new FranciumHandler();
    case 'apricotWithoutLM':
      return new ApricotWithoutLMHandler();
    case 'mango':
      return new MangoHandler();
    case 'tulip':
      return new TulipHandler();
    case 'vault':
      return new VaultHandler();
    case 'drift':
      return new DriftHandler(cluster, program);
    default:
      return null;
  }
};
