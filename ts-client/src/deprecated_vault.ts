import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenInfo } from "@solana/spl-token-registry";
import { BN, Program, Provider } from "@project-serum/anchor";

import { PROGRAM_ID, SOL_MINT, STRATEGY_PROGRAM_ADDRESSES } from "./vault/constants";
import { getOrCreateATAInstruction, getVaultPdas, wrapSOLInstruction } from "./vault/utils";
import { VaultState } from "./vault/types";
import { getStrategyHandler, getStrategyType, StrategyState } from "./vault/strategy";
import { IDL, Vault as VaultIdl } from "./vault/idl";

export type VaultProgram = Program<VaultIdl>;
const LOCKED_PROFIT_DEGRADATION_DENOMINATOR = new BN(1_000_000_000_000);

class Vault {
  public program: VaultProgram;
  public state: VaultState | null = null;
  public walletPubKey: PublicKey | null = null;
  public connection: Connection;

  constructor(provider: Provider, walletPubKey: PublicKey) {
    this.program = new Program<VaultIdl>(IDL as VaultIdl, PROGRAM_ID, provider);
    this.walletPubKey = walletPubKey;
    this.connection = provider.connection;
  }

  public async init(tokenMint: PublicKey) {
    const { vaultPda } = await getVaultPdas(tokenMint, this.program.programId);
    const vaultState = (await this.program.account.vault.fetchNullable(
      vaultPda
    )) as VaultState;

    if (!vaultState) {
      throw "Cannot get vault state";
    }

    this.state = vaultState;
  }


  public getUnlockedAmount(currentTime: number): BN {
    if (!this.state) return new BN(0);

    return this.state.totalAmount.sub(this.calculateLockedProfit(currentTime));
  }

  private calculateLockedProfit(currentTime: number): BN {
    if (!this.state) return new BN(0);
    let currentTimeBN = new BN(currentTime);
    const duration = currentTimeBN.sub(this.state.lockedProfitTracker.lastReport);
    const lockedProfitDegradation =
      this.state.lockedProfitTracker.lockedProfitDegradation;
    const lockedFundRatio = duration.mul(lockedProfitDegradation);
    if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
      return new BN(0);
    }
    const lockedProfit = this.state.lockedProfitTracker.lastUpdatedLockedProfit;
    return lockedProfit.mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio)).div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR);
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
    if (!this.walletPubKey) throw new Error('No wallet PublicKey provided');

    // Get Vault state
    const tokenMint = new PublicKey(tokenInfo.address)
    const { vaultPda, tokenVaultPda } = await this.getPDA(tokenMint);
    const vaultState = await this.program.account.vault.fetch(vaultPda);

    // Add create ATA instructions
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken(tokenMint, vaultState.lpMint);
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    // Wrap desired SOL instructions
    if (tokenMint.equals(SOL_MINT)) {
      preInstructions = preInstructions.concat(
        wrapSOLInstruction(this.walletPubKey, userToken, amount)
      );
    }

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
      console.log('## old', {
        preInstructions,
        vault: vaultPda,
        tokenVault: tokenVaultPda,
        lpMint: vaultState.lpMint,
        userToken,
        userLp: userLpMint,
        user: this.walletPubKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })

      return tx;
    } catch (error) {
      console.trace(error);
      return '';
    }
  }

  public async withdraw(tokenInfo: TokenInfo, amount: number): Promise<string> {
    if (!this.walletPubKey) throw new Error('No wallet PublicKey provided');

    // Add create ATA instructions
    const tokenMint = new PublicKey(tokenInfo.address)
    const { vaultPda, tokenVaultPda } = await this.getPDA(tokenMint);
    const vaultState = await this.program.account.vault.fetch(vaultPda);

    // Wrap desired SOL instructions
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken(tokenMint, vaultState.lpMint);
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    try {
      const tx = await this.program.methods
        .withdraw(new BN(amount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
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

  public async withdrawFromStrategy(
    tokenInfo: TokenInfo,
    vaultStrategyPubkey: PublicKey,
    amount: number,
    strategyProgramAddresses: {
      solend: PublicKey;
      portFinance: PublicKey;
    } = STRATEGY_PROGRAM_ADDRESSES
  ) {
    if (!this.walletPubKey) throw new Error('No wallet PublicKey provided');

    const strategyState = (await this.program.account.strategy.fetchNullable(
      vaultStrategyPubkey
    )) as unknown as StrategyState;

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

    // Get Vault state
    const tokenMint = new PublicKey(tokenInfo.address)
    const { vaultPda, tokenVaultPda } = await this.getPDA(tokenMint);
    const vaultState = await this.program.account.vault.fetch(vaultPda);

    // Add create ATA instructions
    let preInstructions: TransactionInstruction[] = [];
    const { userToken, createUserTokenIx, userLpMint, createUserLpIx } = await this.getUserToken(tokenMint, vaultState.lpMint);
    this.appendUserTokenInstruction(preInstructions, [createUserTokenIx, createUserLpIx]);

    const tx = await strategyHandler.withdraw(
      this.walletPubKey,
      this.program,
      strategy,
      vaultPda,
      tokenVaultPda,
      vaultState.feeVault,
      vaultState.lpMint,
      userToken,
      userLpMint,
      amount,
      preInstructions,
      [],
    );

    return tx;
  }

  private async getPDA(mint: PublicKey) {
    const { vaultPda, tokenVaultPda } = await getVaultPdas(
      mint,
      this.program.programId
    );
    return { vaultPda, tokenVaultPda };
  }

  private async appendUserTokenInstruction(preInstruction: TransactionInstruction[], toAppend: Array<TransactionInstruction | undefined>) {
    toAppend
      .forEach(instruction => {
        if (instruction) {
          preInstruction.push(instruction);
        }
      })
  }

  private async getUserToken(mint: PublicKey, lpMint: PublicKey) {
    if (!this.walletPubKey) throw new Error('No wallet PublicKey provided');

    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      mint,
      this.walletPubKey,
      this.connection
    );
    const [userLpMint, createUserLpIx] = await getOrCreateATAInstruction(
      lpMint,
      this.walletPubKey,
      this.connection
    );

    return { userToken, createUserTokenIx, userLpMint, createUserLpIx }
  }
}

export default Vault;
