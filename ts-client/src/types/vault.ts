import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BN, Program } from "@project-serum/anchor";
import { Vault as VaultIdl } from "../idl/vault";
import { TypeDef } from "@project-serum/anchor/dist/cjs/program/namespace/types";
import { IdlTypes } from "@project-serum/anchor/dist/esm";

export type VaultState = TypeDef<VaultIdl["accounts"]["0"], IdlTypes<VaultIdl>>;

export type StrategyState = TypeDef<
  VaultIdl["accounts"]["1"],
  IdlTypes<VaultIdl>
>;

export type StrategyType =
  | "portFinanceWithoutLm"
  | "solendWithoutLm"
  | "mango"
  | "vault";

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

export type VaultProgram = Program<VaultIdl>;

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
    amount: number,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[]
  ): Promise<string>;
}
