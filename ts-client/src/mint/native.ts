import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Provider, BN } from "@project-serum/anchor";

import { Strategy } from "./index";
import {
  getOrCreateATAInstruction,
  wrapSOLInstruction,
  createCloseAccountTransaction,
} from "../utils";

import { VaultCoin } from ".";
import { StrategyHandler } from "../strategy";
import { getVaultPdas } from "../utils";
import Vault, { VaultProgram } from "../vault";
import { SOL_MINT } from "../constants";

export default class NativeToken implements VaultCoin {
  nativeMint: PublicKey = SOL_MINT;
  vault: Vault;
  program: VaultProgram;
  provider: Provider;
  walletPubKey: PublicKey;
  connection: Connection;

  constructor(vault: Vault) {
    this.vault = vault;
    this.program = vault.program;
    this.provider = vault.program.provider;
    this.walletPubKey = vault.program.provider.wallet.publicKey;
    this.connection = vault.program.provider.connection;
  }

  async getPDA() {
    const { vaultPda, tokenVaultPda } = await getVaultPdas(
      this.nativeMint,
      this.program.programId
    );
    return { vaultPda, tokenVaultPda }; 
  }

  async getUserToken() {
    const { vaultPda } = await  this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);    

    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      this.nativeMint,
      this.walletPubKey,
      this.connection
    );
    const [userLpMint, createUserLpIx] = await getOrCreateATAInstruction(
      vaultState.lpMint,
      this.walletPubKey,
      this.connection
    );

    return { userToken, createUserTokenIx, userLpMint, createUserLpIx }
  }

  async appendUserTokenInstruction(preInstruction: TransactionInstruction[], toAppend: Array<TransactionInstruction | undefined>) {
    toAppend
      .forEach(instruction => {
        if (instruction) {
          preInstruction.push(instruction);
        }
      })
  }

  async deposit(amount: number) {
    const { vaultPda, tokenVaultPda } = await  this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);

    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken();
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    // Wrap desired SOL instructions
    preInstructions = preInstructions.concat(
      wrapSOLInstruction(this.walletPubKey, userToken, amount)
    );

    try {
      const tx = await this.program.methods
        .deposit(new BN(amount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          vault: vaultPda,
          tokenVault: tokenVaultPda,
          lpMint: vaultState.lpMint,
          userToken,
          userLp: userLpMint,
          user: this.walletPubKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .rpc({
          maxRetries: 40,
        });

      return tx;
    } catch (error) {
      console.trace(error);
      return '';
    }
  }

  withdraw = async (unMintAmount: number): Promise<string> => {
    const { vaultPda, tokenVaultPda } = await  this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);

    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken();
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    try {
      const tx = await this.program.methods
        .withdraw(new BN(unMintAmount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          vault: vaultPda,
          tokenVault: tokenVaultPda,
          lpMint: vaultState.lpMint,
          userToken,
          userLp: userLpMint,
          user: this.walletPubKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .rpc({
          maxRetries: 40,
        });

      return tx;
    } catch (error) {
      console.trace(error);
      return '';
    }
  };

  withdrawFromStrategy = async (
    strategy: Strategy,
    strategyHandler: StrategyHandler,
    unMintAmount: number
  ): Promise<string> => {
    const tokenPubkey = this.nativeMint;
    const { vaultPda, tokenVaultPda } = await getVaultPdas(
      tokenPubkey,
      this.program.programId
    );
    const vaultState = await this.program.account.vault.fetch(vaultPda);

    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken();
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    if (!userToken || !userLpMint) {
      return '';
    }

    const postInstruction: Array<TransactionInstruction> = [];

    const tx = await strategyHandler.withdraw(
      this.program,
      strategy,
      vaultPda,
      tokenVaultPda,
      vaultState.feeVault,
      vaultState.lpMint,
      userToken,
      userLpMint,
      unMintAmount,
      preInstructions,
      postInstruction,
    );

    return tx;
  };
}
