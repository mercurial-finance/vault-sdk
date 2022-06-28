import { Wallet } from "@project-serum/anchor";
import { PublicKey, TransactionInstruction, Connection, SYSVAR_CLOCK_PUBKEY, ParsedAccountData, Transaction, Cluster, clusterApiUrl } from "@solana/web3.js";
import Decimal from "decimal.js";
import { BN } from "bn.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { ParsedClockState, VaultImplementation, VaultParams, VaultProgram, VaultState } from "./types";
import { deserializeAccount, getAssociatedTokenAccount, getOrCreateATAInstruction, getVaultPdas, wrapSOLInstruction } from "./utils";
import { PROGRAM_ID, SOL_MINT } from "./constants";
import { getStrategyHandler, getStrategyType, StrategyState } from "./strategy";

const getOnchainTime = async (connection: Connection) => {
    const parsedClock = await connection.getParsedAccountInfo(
        SYSVAR_CLOCK_PUBKEY
    );

    const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData)
        .parsed as ParsedClockState;

    const currentTime = parsedClockAccount.info.unixTimestamp;
    return currentTime;
}

const getVaultState = async (vaultParams: VaultParams, program: VaultProgram): Promise<{ vaultPda: PublicKey, tokenVaultPda: PublicKey, vaultState: VaultState }> => {
    const { vaultPda, tokenVaultPda } = await getVaultPdas(vaultParams.baseTokenMint, new PublicKey(PROGRAM_ID));
    const vaultState = (await program.account.vault.fetchNullable(
        vaultPda
    )) as VaultState;

    if (!vaultState) {
        throw "Cannot get vault state";
    }
    return { vaultPda, tokenVaultPda, vaultState };
}

type VaultDetails = {
    vaultParams: VaultParams,
    vaultPda: PublicKey,
    tokenVaultPda: PublicKey,
    vaultState: VaultState
}

const LOCKED_PROFIT_DEGRADATION_DENOMINATOR = new Decimal(1_000_000_000_000);
export default class VaultImpl implements VaultImplementation {
    private connection: Connection;
    private cluster: Cluster = 'mainnet-beta';

    // Vault
    private vaultParams: VaultParams;
    private program: VaultProgram;
    private vaultPda: PublicKey;
    private tokenVaultPda: PublicKey;
    public vaultState: VaultState;

    private constructor(program: VaultProgram, vaultDetails: VaultDetails, opt?: { cluster?: Cluster }) {
        this.connection = program.provider.connection;
        this.cluster = opt?.cluster ?? 'mainnet-beta';

        this.vaultParams = vaultDetails.vaultParams;
        this.program = program;
        this.vaultPda = vaultDetails.vaultPda;
        this.tokenVaultPda = vaultDetails.tokenVaultPda;
        this.vaultState = vaultDetails.vaultState;
    }

    public static async create(program: VaultProgram, vaultParams: VaultParams, opt?: { cluster?: Cluster }): Promise<VaultImpl> {
        const { vaultPda, tokenVaultPda, vaultState } = await getVaultState(vaultParams, program);
        return new VaultImpl(program, { vaultParams, vaultPda, tokenVaultPda, vaultState }, opt);
    }

    public async getUserBalance(owner: PublicKey): Promise<Decimal> {
        const address = await getAssociatedTokenAccount(this.vaultState.lpMint, owner);
        const accountInfo = await this.connection.getAccountInfo(address);

        if (!accountInfo) {
            return new Decimal(0).toDP(this.vaultParams.baseTokenDecimals);
        }

        const result = deserializeAccount(accountInfo.data);
        if (result == undefined) {
            throw new Error("Failed to parse user account for LP token.");
        }

        return new Decimal(result.amount.toString()).toDP(this.vaultParams.baseTokenDecimals);
    };

    public async getVaultSupply(): Promise<Decimal> {
        const context = await this.connection.getTokenSupply(this.vaultState.lpMint);
        return new Decimal(context.value.amount).toDP(this.vaultParams.baseTokenDecimals);
    };

    public async getWithdrawableAmount(): Promise<Decimal> {
        const currentTime = await getOnchainTime(this.connection);
        const vaultTotalAmount = new Decimal(this.vaultState.totalAmount.toString());

        const {
            lockedProfitTracker: {
                lastReport,
                lockedProfitDegradation,
                lastUpdatedLockedProfit
            }
        } = this.vaultState;

        const duration = new Decimal(currentTime).sub(lastReport.toString());

        const lockedFundRatio = duration.mul(lockedProfitDegradation.toString());
        if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
            return new Decimal(0);
        }

        const lockedProfit = new Decimal(lastUpdatedLockedProfit.toString())
            .mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio))
            .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)
        return vaultTotalAmount.sub(lockedProfit);
    };

    private async refreshVaultState() {
        const { vaultPda, tokenVaultPda, vaultState } = await getVaultState(this.vaultParams, this.program);
        this.vaultPda = vaultPda;
        this.tokenVaultPda = tokenVaultPda;
        this.vaultState = vaultState;
    }

    public async deposit(wallet: Wallet, baseTokenAmount: Decimal): Promise<Transaction> {
        // Refresh vault state
        await this.refreshVaultState();

        let preInstructions: TransactionInstruction[] = [];
        const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(this.vaultParams.baseTokenMint, wallet.publicKey, this.connection);
        const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(this.vaultState.lpMint, wallet.publicKey, this.connection);
        if (createUserTokenIx) {
            preInstructions.push(createUserTokenIx);
        }
        if (createUserLpTokenIx) {
            preInstructions.push(createUserLpTokenIx);
        }
        // If it's SOL vault, wrap desired amount of SOL
        if (this.vaultParams.baseTokenMint.equals(SOL_MINT)) {
            preInstructions = preInstructions.concat(
                wrapSOLInstruction(wallet.publicKey, userToken, baseTokenAmount.toNumber())
            );
        }

        const tx = await this.program.methods
            .deposit(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
            .accounts({
                vault: this.vaultPda,
                tokenVault: this.tokenVaultPda,
                lpMint: this.vaultState.lpMint,
                userToken,
                userLp: userLpToken,
                user: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions(preInstructions)
            .transaction()
        return tx;
    };

    public async withdraw(wallet: Wallet, baseTokenAmount: Decimal): Promise<Transaction> {
        // Refresh vault state
        await this.refreshVaultState();

        let preInstructions: TransactionInstruction[] = [];
        const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(this.vaultParams.baseTokenMint, wallet.publicKey, this.connection);
        const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(this.vaultState.lpMint, wallet.publicKey, this.connection);
        if (createUserTokenIx) {
            preInstructions.push(createUserTokenIx);
        }
        if (createUserLpTokenIx) {
            preInstructions.push(createUserLpTokenIx);
        }

        const tx = await this.program.methods
            .withdraw(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
            .accounts({
                vault: this.vaultPda,
                tokenVault: this.tokenVaultPda,
                lpMint: this.vaultState.lpMint,
                userToken,
                userLp: userLpToken,
                user: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions(preInstructions)
            .transaction()
        return tx;
    };

    public async withdrawFromStrategy(wallet: Wallet, vaultStrategyPubkey: PublicKey, baseTokenAmount: Decimal): Promise<Transaction | { error: string }> {
        // Refresh vault state
        await this.refreshVaultState()

        // TODO: Refactor this part, to use strategy class directly
        const strategyState = (await this.program.account.strategy.fetchNullable(
            vaultStrategyPubkey
        )) as unknown as StrategyState;

        if (strategyState.currentLiquidity.eq(new BN(0))) {
            // TODO, must compare currentLiquidity + vaulLiquidity > unmintAmount * virtualPrice
            return { error: 'Selected strategy does not have enough liquidity.' };
        }

        const strategy = {
            pubkey: vaultStrategyPubkey,
            state: strategyState,
        };
        const strategyType = getStrategyType(strategyState.strategyType);
        const strategyHandler = getStrategyHandler(strategyType, this.cluster);

        if (!strategyType || !strategyHandler) {
            throw new Error("Cannot find strategy handler");
        }

        let preInstructions: TransactionInstruction[] = [];
        const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(this.vaultParams.baseTokenMint, wallet.publicKey, this.connection);
        const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(this.vaultState.lpMint, wallet.publicKey, this.connection);
        if (createUserTokenIx) {
            preInstructions.push(createUserTokenIx);
        }
        if (createUserLpTokenIx) {
            preInstructions.push(createUserLpTokenIx);
        }

        const tx = await strategyHandler.withdraw(
            wallet.publicKey,
            this.program,
            strategy,
            this.vaultPda,
            this.tokenVaultPda,
            this.vaultState.feeVault,
            this.vaultState.lpMint,
            userToken,
            userLpToken,
            baseTokenAmount.toNumber(),
            preInstructions,
            [],
        );
        return tx;
    }
}
