import { BN, Program } from '@project-serum/anchor';
import { TokenInfo } from '@solana/spl-token-registry';
import { PublicKey, Transaction } from '@solana/web3.js';

import { Vault as VaultIdl } from '../idl';
import { AffiliateVault as AffiliateVaultIdl } from '../affiliate-idl';

export type VaultProgram = Program<VaultIdl>;
export type AffiliateVaultProgram = Program<AffiliateVaultIdl>;

export type VaultImplementation = {
  getUserBalance: (owner: PublicKey) => Promise<BN>;
  getVaultSupply: () => Promise<BN>;
  getWithdrawableAmount: (ownerPublicKey: PublicKey) => Promise<BN>;
  deposit: (owner: PublicKey, baseTokenAmount: BN) => Promise<Transaction>;
  withdraw: (owner: PublicKey, baseTokenAmount: BN) => Promise<Transaction | { error: string }>;
};

export interface VaultState {
  admin: PublicKey;
  base: PublicKey;
  bumps: {
    vaultBump: number;
    tokenVaultBump: number;
  };
  enabled: 1 | 0;
  feeVault: PublicKey;
  lockedProfitTracker: {
    lastUpdatedLockedProfit: BN;
    lastReport: BN;
    lockedProfitDegradation: BN;
  };
  lpMint: PublicKey;
  operator: PublicKey;
  strategies: Array<PublicKey>;
  tokenMint: PublicKey;
  tokenVault: PublicKey;
  totalAmount: BN;
}

export type VaultDetails = {
  tokenInfo: TokenInfo;
  vaultPda: PublicKey;
  tokenVaultPda: PublicKey;
  vaultState: VaultState;
  lpSupply: BN;
};

export enum StrategyType {
  PortFinanceWithoutLM = 'PortFinanceWithoutLM',
  PortFinanceWithLM = 'PortFinanceWithLM',
  SolendWithoutLM = 'SolendWithoutLM',
  Mango = 'Mango',
  Vault = 'Vault',
}

export type StrategyInfo = {
  pubkey: string;
  reserve: string;
  strategy_type: StrategyType;
  strategy_name: string;
  liquidity: number;
  reward: number;
  apy: number;
};

/** Utils */
export interface ParsedClockState {
  info: {
    epoch: number;
    epochStartTimestamp: number;
    leaderScheduleEpoch: number;
    slot: number;
    unixTimestamp: number;
  };
  type: string;
  program: string;
  space: number;
}
