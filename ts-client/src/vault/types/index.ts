import { BN, IdlTypes, Program } from '@coral-xyz/anchor';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TypeDef } from '@coral-xyz/anchor/dist/cjs/program/namespace/types';

import { Vault as VaultIdl } from '../idl';
import { AffiliateVault as AffiliateVaultIdl } from '../affiliate-idl';
import { Mint } from '@solana/spl-token';

export type VaultProgram = Program<VaultIdl>;
export type AffiliateVaultProgram = Program<AffiliateVaultIdl>;

export type VaultImplementation = {
  getUserBalance: (owner: PublicKey) => Promise<BN>;
  getVaultSupply: () => Promise<BN>;
  getWithdrawableAmount: (ownerPublicKey: PublicKey) => Promise<BN>;
  deposit: (owner: PublicKey, baseTokenAmount: BN) => Promise<Transaction>;
  withdraw: (owner: PublicKey, baseTokenAmount: BN) => Promise<Transaction | { error: string }>;

  // Affiliate
  getAffiliateInfo: () => Promise<AffiliateInfo>;
};

export type VaultState = TypeDef<VaultIdl['accounts']['0'], IdlTypes<VaultIdl>>;

/** Affiliate */
export interface AffiliateInfo {
  partnerToken: PublicKey;
  vault: PublicKey;
  outstandingFee: BN;
  feeRatio: BN;
  cummulativeFee: BN;
}

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

export interface VaultStateAndLp {
  vaultPda: PublicKey;
  vaultState: VaultState;
  vaultLpMint: Mint;
  vaultMint: Mint;
}
