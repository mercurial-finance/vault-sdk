import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenInfo } from "@solana/spl-token-registry";
import { AnchorProvider, BN, Program, Wallet } from "@project-serum/anchor";
import invariant from "invariant";

import {
  PROGRAM_ID,
  SOL_MINT,
  STRATEGY_PROGRAM_ADDRESSES,
} from "../../constants/vault";
import { getVaultPdas } from "../../utils/vault";
import { getOrCreateATAInstruction, wrapSOLInstruction } from "../../utils";
import { StrategyState, VaultProgram, VaultState } from "../../types/vault";
import { getStrategyHandler, getStrategyType } from "./strategy";
import { IDL, Vault as VaultIdl } from "../../idl/vault";

const LOCKED_PROFIT_DEGRADATION_DENOMINATOR = new BN(1_000_000_000_000);

class Vault {
  constructor(
    private program: VaultProgram,
    private wallet: Wallet,
    private vaultPubKey: PublicKey,
    private vaultLpPubKey: PublicKey,
    public state: VaultState
  ) {}

  static async load(
    wallet: Wallet,
    connection: Connection,
    tokenMint: PublicKey
  ) {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "processed",
    });
    const program = new Program<VaultIdl>(
      IDL as VaultIdl,
      PROGRAM_ID,
      provider
    );
    const { vaultPda, tokenVaultPda } = await getVaultPdas(
      tokenMint,
      program.programId
    );
    const vaultState = (await program.account.vault.fetchNullable(
      vaultPda
    )) as VaultState;

    invariant(vaultState, `Vault ${tokenMint.toBase58()} not found`);

    return new Vault(program, wallet, vaultPda, tokenVaultPda, vaultState);
  }

  public getUnlockedAmount(currentTime: number): BN {
    if (!this.state) return new BN(0);

    return this.state.totalAmount.sub(this.calculateLockedProfit(currentTime));
  }

  public getAmountByShare(currentTime: number, share: BN, totalSupply: BN): BN {
    const totalAmount = this.getUnlockedAmount(currentTime);
    return share.mul(totalAmount).div(totalSupply);
  }

  public getUnmintAmount(currentTime: number, outToken: BN, totalSupply: BN) {
    const totalAmount = this.getUnlockedAmount(currentTime);
    return outToken.mul(totalSupply).div(totalAmount);
  }

  public async deposit(tokenInfo: TokenInfo, amount: number) {
    // Get Vault state
    const tokenMint = new PublicKey(tokenInfo.address);

    // Add create ATA instructions
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } =
      await this.getUserToken(tokenMint, this.state.lpMint);
    this.appendUserTokenInstruction(preInstructions, [
      createUserTokenIx,
      createUserLpIx,
    ]);

    // Wrap desired SOL instructions
    if (tokenMint.equals(SOL_MINT)) {
      preInstructions = preInstructions.concat(
        wrapSOLInstruction(this.wallet.publicKey, userToken, amount)
      );
    }

    try {
      const tx = await this.program.methods
        .deposit(new BN(amount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          vault: this.vaultPubKey,
          tokenVault: this.vaultLpPubKey,
          lpMint: this.state.lpMint,
          userToken,
          userLp: userLpMint,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .rpc({
          maxRetries: 40,
        });

      return tx;
    } catch (error) {
      console.trace(error);
      return "";
    }
  }

  public async withdraw(tokenInfo: TokenInfo, amount: number): Promise<string> {
    // Add create ATA instructions
    const tokenMint = new PublicKey(tokenInfo.address);

    // Wrap desired SOL instructions
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } =
      await this.getUserToken(tokenMint, this.state.lpMint);
    this.appendUserTokenInstruction(preInstructions, [
      createUserTokenIx,
      createUserLpIx,
    ]);

    try {
      const tx = await this.program.methods
        .withdraw(new BN(amount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          vault: this.vaultPubKey,
          tokenVault: this.vaultLpPubKey,
          lpMint: this.state.lpMint,
          userToken,
          userLp: userLpMint,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .rpc({
          maxRetries: 40,
        });

      return tx;
    } catch (error) {
      console.trace(error);
      return "";
    }
  }

  public async withdrawFromStrategy(
    tokenInfo: TokenInfo,
    vaultStrategyPubkey: PublicKey,
    amount: number,
    strategyProgramAddresses: {
      solend: PublicKey;
      portFinance: PublicKey;
    } = STRATEGY_PROGRAM_ADDRESSES
  ) {
    const strategyState = (await this.program.account.strategy.fetch(
      vaultStrategyPubkey
    )) as StrategyState;

    if (strategyState.currentLiquidity.eq(new BN(0))) {
      // TODO, must compare currentLiquidity + vaulLiquidity > unmintAmount * virtualPrice
      return;
    }
    const strategy = {
      pubkey: vaultStrategyPubkey,
      state: strategyState,
    };
    const strategyType = getStrategyType(strategyState.strategyType);
    const strategyHandler = getStrategyHandler(
      strategyType,
      strategyProgramAddresses
    );
    if (!strategyType || !strategyHandler) {
      throw new Error("Cannot find strategy handler");
    }

    const tokenMint = new PublicKey(tokenInfo.address);

    // Add create ATA instructions
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } =
      await this.getUserToken(tokenMint, this.state.lpMint);
    this.appendUserTokenInstruction(preInstructions, [
      createUserTokenIx,
      createUserLpIx,
    ]);

    const tx = await strategyHandler.withdraw(
      this.wallet.publicKey,
      this.program,
      strategy,
      this.vaultPubKey,
      this.vaultLpPubKey,
      this.state.feeVault,
      this.state.lpMint,
      userToken,
      userLpMint,
      amount,
      preInstructions,
      []
    );

    return tx;
  }

  /** ---Private function--- */
  private async appendUserTokenInstruction(
    preInstruction: TransactionInstruction[],
    toAppend: Array<TransactionInstruction | undefined>
  ) {
    toAppend.forEach((instruction) => {
      if (instruction) {
        preInstruction.push(instruction);
      }
    });
  }

  private async getUserToken(mint: PublicKey, lpMint: PublicKey) {
    const walletPubKey = this.wallet.publicKey;
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      mint,
      walletPubKey,
      this.program.provider.connection
    );
    const [userLpMint, createUserLpIx] = await getOrCreateATAInstruction(
      lpMint,
      walletPubKey,
      this.program.provider.connection
    );

    return { userToken, createUserTokenIx, userLpMint, createUserLpIx };
  }

  private calculateLockedProfit(currentTime: number): BN {
    if (!this.state) return new BN(0);
    let currentTimeBN = new BN(currentTime);
    const duration = currentTimeBN.sub(
      this.state.lockedProfitTracker.lastReport
    );
    const lockedProfitDegradation =
      this.state.lockedProfitTracker.lockedProfitDegradation;
    const lockedFundRatio = duration.mul(lockedProfitDegradation);
    if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
      return new BN(0);
    }
    const lockedProfit = this.state.lockedProfitTracker.lastUpdatedLockedProfit;
    return lockedProfit
      .mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio))
      .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR);
  }
}

export default Vault;
