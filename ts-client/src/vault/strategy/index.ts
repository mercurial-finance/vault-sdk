import { BN } from '@coral-xyz/anchor';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import type { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';

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
  | 'drift'
  | 'frakt'
  | 'cypher'
  | 'psylend'
  | 'marginfi';

export type StrategyState = {
  reserve: PublicKey;
  collateralVault: PublicKey;
  strategyType: object;
  bumps: number[];
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
    walletPubKey: PublicKey,
    program: VaultProgram,
    strategy: any,
    vault: PublicKey,
    tokenVault: PublicKey,
    vaultState: VaultState,
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
