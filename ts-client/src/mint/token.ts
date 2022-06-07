import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenInfo } from "@solana/spl-token-registry";
import  { BN, Provider } from "@project-serum/anchor";

import { Strategy, VaultCoin } from "./index";
import { StrategyHandler } from "../strategy";
import { getOrCreateATAInstruction, toDecimal, getVaultPdas } from "../utils";
import Vault, { VaultProgram } from "../vault";

export default class MintToken implements VaultCoin {
  mint: PublicKey;
  tokenInfo: TokenInfo;
  vault: Vault;
  program: VaultProgram;
  provider: Provider;
  walletPubKey: PublicKey;
  connection: Connection;

  constructor(tokenInfo: TokenInfo, vault: Vault, walletPubKey: PublicKey) {
    this.mint = new PublicKey(tokenInfo.address);
    this.tokenInfo = tokenInfo;
    
    this.vault = vault;
    this.program = vault.program;
    this.provider = vault.program.provider;
    this.walletPubKey = walletPubKey;
    this.connection = vault.program.provider.connection;
  }


  async getPDA() {
    const { vaultPda, tokenVaultPda } = await getVaultPdas(
      this.mint,
      this.program.programId
    );
    return { vaultPda, tokenVaultPda }; 
  }

  async getUserToken() {
    const { vaultPda } = await  this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);    

    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      this.mint,
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

  deposit = async (amount: number) => {
    const { vaultPda, tokenVaultPda } = await this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);
    
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken();
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    const tx = await this.vault.program.methods
      .deposit(
        new BN(toDecimal(amount, this.tokenInfo.decimals)),
        new BN(0) // Vault does not have slippage, second parameter is ignored.
      )
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
  };

  withdraw = async (unmintAmount: number): Promise<string> => {
    const { vaultPda, tokenVaultPda } = await this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);
    
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken();
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    const tx = await this.vault.program.methods
      .withdraw(new BN(unmintAmount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
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
  };

  withdrawFromStrategy = async (
    strategy: Strategy,
    strategyHandler: StrategyHandler,
    unmintAmount: number
  ): Promise<string> => {
    const { vaultPda, tokenVaultPda } = await this.getPDA();
    const vaultState = await this.program.account.vault.fetch(vaultPda);
    const { lpMint } = vaultState;

    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken();
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    if (!userToken || !userLpMint) {
      throw Error("Cannot find or create user ATA");
    }

    const tx = await strategyHandler.withdraw(
      this.walletPubKey,
      this.program,
      strategy,
      vaultPda,
      tokenVaultPda,
      vaultState.feeVault,
      lpMint,
      userToken,
      userLpMint,
      unmintAmount,
      preInstructions,
      []
    );
    return tx;
  };
}
