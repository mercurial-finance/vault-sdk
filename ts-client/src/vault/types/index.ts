import { BN, Program, Wallet } from "@project-serum/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import Decimal from "decimal.js";

import { Vault as VaultIdl } from "../idl";

export type VaultProgram = Program<VaultIdl>;

export type VaultImplementation = {
    getUserBalance: (owner: PublicKey) => Promise<Decimal>;
    getVaultSupply: () => Promise<Decimal>;
    getWithdrawableAmount: (ownerPublicKey: PublicKey) => Promise<Decimal>;
    deposit: (
        wallet: Wallet,
        baseTokenAmount: Decimal
    ) => Promise<Transaction>;
    withdraw: (
        wallet: Wallet,
        baseTokenAmount: Decimal
    ) => Promise<Transaction>;
    withdrawFromStrategy: (
        wallet: Wallet,
        vaultStrategyPubkey: PublicKey,
        baseTokenAmount: Decimal
    ) => Promise<Transaction | { error: string }>
}

export type VaultParams = {
    baseTokenMint: PublicKey;
    baseTokenDecimals: number;
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

export enum StrategyType {
    PortFinanceWithoutLM = 'PortFinanceWithoutLM',
    PortFinanceWithLM = 'PortFinanceWithLM',
    SolendWithoutLM = 'SolendWithoutLM',
    Mango = 'Mango',
    Vault = 'Vault',
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