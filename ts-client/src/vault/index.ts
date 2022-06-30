import { AnchorProvider, Program } from "@project-serum/anchor";
import { PublicKey, TransactionInstruction, Connection, SYSVAR_CLOCK_PUBKEY, ParsedAccountData, Transaction, Cluster } from "@solana/web3.js";
import Decimal from "decimal.js";
import { BN } from "bn.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { ParsedClockState, VaultImplementation, VaultParams, VaultProgram, VaultState } from "./types";
import { deserializeAccount, getAssociatedTokenAccount, getOrCreateATAInstruction, getVaultPdas, unwrapSOLInstruction, wrapSOLInstruction } from "./utils";
import { PROGRAM_ID, SOL_MINT } from "./constants";
import { getStrategyHandler, getStrategyType, StrategyState } from "./strategy";
import { IDL, Vault as VaultIdl } from "./idl";

const getOnchainTime = async (connection: Connection) => {
    const parsedClock = await connection.getParsedAccountInfo(
        SYSVAR_CLOCK_PUBKEY
    );

    const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData)
        .parsed as ParsedClockState;

    const currentTime = parsedClockAccount.info.unixTimestamp;
    return currentTime;
}

const getLpSupply = async (connection: Connection, tokenMint: PublicKey): Promise<string> => {
    const context = await connection.getTokenSupply(tokenMint);
    const result = new Decimal(context.value.amount).toDP(context.value.decimals).toString();
    return result;
}

const getVaultState = async (
    vaultParams: VaultParams,
    program: VaultProgram
): Promise<{ vaultPda: PublicKey, tokenVaultPda: PublicKey, vaultState: VaultState, lpSupply: string }> => {
    const { vaultPda, tokenVaultPda } = await getVaultPdas(vaultParams.baseTokenMint, new PublicKey(program.programId));
    const vaultState = (await program.account.vault.fetchNullable(
        vaultPda
    )) as VaultState;
    const lpSupply = await getLpSupply(program.provider.connection, vaultState.lpMint);

    if (!vaultState) {
        throw "Cannot get vault state";
    }
    return { vaultPda, tokenVaultPda, vaultState, lpSupply };
}

const getVaultLiquidity = async (connection: Connection, tokenVaultPda: PublicKey): Promise<string | null> => {
    const vaultLiquidityResponse = await connection.getAccountInfo(tokenVaultPda)
    if (!vaultLiquidityResponse) return null;

    const vaultLiquidtySerialize = deserializeAccount(vaultLiquidityResponse.data)
    return vaultLiquidtySerialize?.amount.toString() || null;
}

type VaultDetails = {
    vaultParams: VaultParams,
    vaultPda: PublicKey,
    tokenVaultPda: PublicKey,
    vaultState: VaultState,
    lpSupply: string,
}

type VaultInfo = {
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

const VAULT_STRATEGY_ADDRESS = '11111111111111111111111111111111';
const LOCKED_PROFIT_DEGRADATION_DENOMINATOR = new Decimal(1_000_000_000_000);
export default class VaultImpl implements VaultImplementation {
    private connection: Connection;
    private cluster: Cluster = 'mainnet-beta';

    // Vault
    private vaultParams: VaultParams;
    private program: VaultProgram;

    public vaultPda: PublicKey;
    public tokenVaultPda: PublicKey;
    public vaultState: VaultState;
    public lpSupply: string = '';

    private constructor(program: VaultProgram, vaultDetails: VaultDetails, opt?: { cluster?: Cluster }) {
        this.connection = program.provider.connection;
        this.cluster = opt?.cluster ?? 'mainnet-beta';

        this.vaultParams = vaultDetails.vaultParams;
        this.program = program;
        this.vaultPda = vaultDetails.vaultPda;
        this.tokenVaultPda = vaultDetails.tokenVaultPda;
        this.vaultState = vaultDetails.vaultState;
        this.lpSupply = vaultDetails.lpSupply;
    }

    public static async create(
        connection: Connection,
        vaultParams: VaultParams,
        opt?: {
            cluster?: Cluster,
            programId?: string,
        }
    ): Promise<VaultImpl> {
        const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
        const program = new Program<VaultIdl>(
            IDL as VaultIdl,
            opt?.programId || PROGRAM_ID,
            provider
        );

        const { vaultPda, tokenVaultPda, vaultState, lpSupply } = await getVaultState(vaultParams, program);
        return new VaultImpl(program, { vaultParams, vaultPda, tokenVaultPda, vaultState, lpSupply }, opt);
    }

    public async getUserBalance(owner: PublicKey): Promise<string> {
        const address = await getAssociatedTokenAccount(this.vaultState.lpMint, owner);
        const accountInfo = await this.connection.getAccountInfo(address);

        if (!accountInfo) {
            return new Decimal(0).toDP(this.vaultParams.baseTokenDecimals).toString();
        }

        const result = deserializeAccount(accountInfo.data);
        if (result == undefined) {
            throw new Error("Failed to parse user account for LP token.");
        }

        return new Decimal(result.amount.toString()).toDP(this.vaultParams.baseTokenDecimals).toString();
    };

    /** To refetch the latest lpSupply */
    /** Use vaultImpl.lpSupply to use cached result */
    public async getVaultSupply(): Promise<string> {
        const lpSupply = await getLpSupply(this.connection, this.vaultState.lpMint);
        this.lpSupply = lpSupply;
        return lpSupply;
    };

    public async getWithdrawableAmount(): Promise<string> {
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
            return new Decimal(0).toString();
        }

        const lockedProfit = new Decimal(lastUpdatedLockedProfit.toString())
            .mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio))
            .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)
        return vaultTotalAmount.sub(lockedProfit).toDP(0).toString();
    };

    private async refreshVaultState() {
        const { vaultPda, tokenVaultPda, vaultState } = await getVaultState(this.vaultParams, this.program);
        this.vaultPda = vaultPda;
        this.tokenVaultPda = tokenVaultPda;
        this.vaultState = vaultState;
    }

    public async deposit(owner: PublicKey, baseTokenAmount: number): Promise<Transaction> {
        // Refresh vault state
        await this.refreshVaultState();

        let preInstructions: TransactionInstruction[] = [];
        const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(this.vaultParams.baseTokenMint, owner, this.connection);
        const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(this.vaultState.lpMint, owner, this.connection);
        if (createUserTokenIx) {
            preInstructions.push(createUserTokenIx);
        }
        if (createUserLpTokenIx) {
            preInstructions.push(createUserLpTokenIx);
        }
        // If it's SOL vault, wrap desired amount of SOL
        if (this.vaultParams.baseTokenMint.equals(SOL_MINT)) {
            preInstructions = preInstructions.concat(
                wrapSOLInstruction(owner, userToken, baseTokenAmount)
            );
        }

        const depositTx = await this.program.methods
            .deposit(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
            .accounts({
                vault: this.vaultPda,
                tokenVault: this.tokenVaultPda,
                lpMint: this.vaultState.lpMint,
                userToken,
                userLp: userLpToken,
                user: owner,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions(preInstructions)
            .transaction()

        return new Transaction({ feePayer: owner, ...await this.connection.getLatestBlockhash() })
            .add(depositTx);
    };

    private async getStrategyWithHighestLiquidity(strategy?: PublicKey) {
        // Reserved for testing
        if (strategy) {
            const strategyState = (await this.program.account.strategy.fetchNullable(
                strategy
            )) as unknown as StrategyState;
            return { publicKey: strategy, strategyState };
        }

        const vaultStrategiesStatePromise = this.vaultState.strategies
            .filter(address => address.toString() !== VAULT_STRATEGY_ADDRESS)
            .map(async strat => {
                const strategyState = (await this.program.account.strategy.fetchNullable(
                    strat
                )) as unknown as StrategyState;
                return { publicKey: strat, strategyState };
            })
        const vaultStrategiesState = await Promise.all(vaultStrategiesStatePromise);
        const highestLiquidity = vaultStrategiesState.sort((a, b) => b.strategyState.currentLiquidity.sub(a.strategyState.currentLiquidity).toNumber())[0];
        return highestLiquidity
            ? highestLiquidity
            : {
                publicKey: new PublicKey(VAULT_STRATEGY_ADDRESS),
                strategyState: null
            };
    }

    public async withdraw(owner: PublicKey, baseTokenAmount: number, opt?: { strategy?: PublicKey }): Promise<Transaction> {
        // Refresh vault state
        await this.refreshVaultState()

        // Get strategy with highest liquidity
        // opt.strategy reserved for testing
        const selectedStrategy = await this.getStrategyWithHighestLiquidity(opt?.strategy);
        if (
            !selectedStrategy // If there's no strategy deployed to the vault, use Vault Reserves instead
            || selectedStrategy.publicKey.toString() === VAULT_STRATEGY_ADDRESS // If opt.strategy specified Vault Reserves
            || !selectedStrategy.strategyState // If opt.strategy specified Vault Reserves
        ) {
            return this.withdrawFromVaultReserve(owner, baseTokenAmount);
        }

        const currentLiquidity = new BN(selectedStrategy.strategyState.currentLiquidity)
        const vaultLiquidty = new BN(await getVaultLiquidity(this.connection, this.tokenVaultPda) || 0)
        const unlockedAmount = await this.getWithdrawableAmount();
        const virtualPrice = new BN(unlockedAmount).div(new BN(this.lpSupply))

        const availableAmount = currentLiquidity.add(vaultLiquidty);
        const amountToUnmint = new BN(baseTokenAmount).mul(virtualPrice)
        if (amountToUnmint.gt(availableAmount)) {
            throw new Error('Selected strategy does not have enough liquidity.');
        }

        const strategyType = getStrategyType(selectedStrategy.strategyState.strategyType);
        const strategyHandler = getStrategyHandler(strategyType, this.cluster);

        if (!strategyType || !strategyHandler) {
            throw new Error("Cannot find strategy handler");
        }

        let preInstructions: TransactionInstruction[] = [];
        const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(this.vaultParams.baseTokenMint, owner, this.connection);
        const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(this.vaultState.lpMint, owner, this.connection);
        if (createUserTokenIx) {
            preInstructions.push(createUserTokenIx);
        }
        if (createUserLpTokenIx) {
            preInstructions.push(createUserLpTokenIx);
        }

        // Unwrap SOL
        const postInstruction: Array<TransactionInstruction> = [];
        if (this.vaultParams.baseTokenMint.equals(SOL_MINT)) {
            const closeWrappedSOLIx = await unwrapSOLInstruction(owner);
            if (closeWrappedSOLIx) {
                postInstruction.push(closeWrappedSOLIx);
            }
        }

        const withdrawFromStrategyTx = await strategyHandler.withdraw(
            owner,
            this.program,
            {
                pubkey: selectedStrategy.publicKey,
                state: selectedStrategy.strategyState,
            },
            this.vaultPda,
            this.tokenVaultPda,
            this.vaultState.feeVault,
            this.vaultState.lpMint,
            userToken,
            userLpToken,
            baseTokenAmount,
            preInstructions,
            postInstruction,
        );

        if (withdrawFromStrategyTx instanceof Transaction) {
            return new Transaction({ feePayer: owner, ...await this.connection.getLatestBlockhash() })
                .add(withdrawFromStrategyTx);
        }

        // Return error
        throw new Error(withdrawFromStrategyTx.error)
    }

    // Reserved code to withdraw from Vault Reserves directly.
    // The only situation this piece of code will be required, is when a single Vault have no other strategy, and only have its own reserve.
    private async withdrawFromVaultReserve(owner: PublicKey, baseTokenAmount: number): Promise<Transaction> {
        let preInstructions: TransactionInstruction[] = [];
        const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(this.vaultParams.baseTokenMint, owner, this.connection);
        const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(this.vaultState.lpMint, owner, this.connection);
        if (createUserTokenIx) {
            preInstructions.push(createUserTokenIx);
        }
        if (createUserLpTokenIx) {
            preInstructions.push(createUserLpTokenIx);
        }

        // Unwrap SOL
        const postInstruction: Array<TransactionInstruction> = [];
        if (this.vaultParams.baseTokenMint.equals(SOL_MINT)) {
            const closeWrappedSOLIx = await unwrapSOLInstruction(owner);
            if (closeWrappedSOLIx) {
                postInstruction.push(closeWrappedSOLIx);
            }
        }

        const withdrawTx = await this.program.methods
            .withdraw(new BN(baseTokenAmount), new BN(0)) // Vault does not have slippage, second parameter is ignored.
            .accounts({
                vault: this.vaultPda,
                tokenVault: this.tokenVaultPda,
                lpMint: this.vaultState.lpMint,
                userToken,
                userLp: userLpToken,
                user: owner,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions(preInstructions)
            .postInstructions(postInstruction)
            .transaction()

        return new Transaction({ feePayer: owner, ...await this.connection.getLatestBlockhash() })
            .add(withdrawTx);
    };
}
