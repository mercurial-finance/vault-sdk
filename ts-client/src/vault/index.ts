import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import {
  PublicKey,
  TransactionInstruction,
  Connection,
  Transaction,
  Cluster,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from '@solana/web3.js';
import { MintLayout, TOKEN_PROGRAM_ID, u64, NATIVE_MINT } from '@solana/spl-token';
import { TokenInfo } from '@solana/spl-token-registry';

import { AffiliateInfo, AffiliateVaultProgram, VaultImplementation, VaultProgram, VaultState } from './types';
import {
  chunkedFetchMultipleVaultAccount,
  chunkedGetMultipleAccountInfos,
  deserializeAccount,
  getAssociatedTokenAccount,
  getLpSupply,
  getOnchainTime,
  getOrCreateATAInstruction,
  getVaultPdas,
  unwrapSOLInstruction,
  wrapSOLInstruction,
} from './utils';
import { AFFILIATE_PROGRAM_ID, PROGRAM_ID, SEEDS, VAULT_BASE_KEY, VAULT_STRATEGY_ADDRESS } from './constants';
import { getStrategyHandler, getStrategyType, StrategyState } from './strategy';
import { IDL, Vault as VaultIdl } from './idl';
import { IDL as AffiliateIDL, AffiliateVault as AffiliateVaultIdl } from './affiliate-idl';
import { calculateWithdrawableAmount } from './helper';

type TokenInfoPda = { info: TokenInfo; vaultPda: PublicKey; tokenVaultPda: PublicKey; lpMintPda: PublicKey };

type VaultDetails = {
  tokenInfo: TokenInfo;
  vaultPda: PublicKey;
  tokenVaultPda: PublicKey;
  lpMintPda: PublicKey;
  vaultState: VaultState;
  lpSupply: BN;
};

type WithdrawOpt = {
  affiliate: {
    affiliateId: PublicKey;
    affiliateProgram: AffiliateVaultProgram;
    partner: PublicKey;
    user: PublicKey;
  };
};

const getAllVaultState = async (tokenInfos: Array<TokenInfo>, program: VaultProgram, seedBaseKey?: PublicKey) => {
  const vaultAccountPdas = tokenInfos.map((tokenInfo) =>
    getVaultPdas(new PublicKey(tokenInfo.address), new PublicKey(program.programId), seedBaseKey),
  );

  const vaultPdas = vaultAccountPdas.map(({ vaultPda }) => vaultPda);
  const vaultsState = (await chunkedFetchMultipleVaultAccount(program, vaultPdas)) as Array<VaultState>;

  if (vaultsState.length !== tokenInfos.length) {
    throw new Error('Some of the vault state cannot be fetched');
  }

  const vaultLpMints = vaultsState.map((vaultState) => vaultState.lpMint);
  const vaultLpAccounts = await chunkedGetMultipleAccountInfos(program.provider.connection, vaultLpMints);

  return vaultsState.map((vaultState, index) => {
    const vaultAccountPda = vaultAccountPdas[index];
    if (!vaultAccountPda) throw new Error('Missing vault account pda');
    const vaultLpAccount = vaultLpAccounts[index];
    if (!vaultLpAccount) throw new Error('Missing vault lp account');
    const lpSupply = new BN(u64.fromBuffer(MintLayout.decode(vaultLpAccount.data).supply));

    return { ...vaultAccountPda, vaultState, lpSupply };
  });
};

const getAllVaultStateByPda = async (tokensInfoPda: Array<TokenInfoPda>, program: VaultProgram) => {
  const vaultPdas = tokensInfoPda.map(({ vaultPda }) => vaultPda);
  const vaultsState = (await chunkedFetchMultipleVaultAccount(program, vaultPdas)) as Array<VaultState>;

  if (vaultsState.length !== tokensInfoPda.length) {
    throw new Error('Some of the vault state cannot be fetched');
  }

  const vaultLpMints = vaultsState.map((vaultState) => vaultState.lpMint);
  const vaultLpAccounts = await chunkedGetMultipleAccountInfos(program.provider.connection, vaultLpMints);

  return vaultsState.map((vaultState, index) => {
    const vaultAccountPda = tokensInfoPda[index];
    if (!vaultAccountPda) throw new Error('Missing vault account pda');
    const vaultLpAccount = vaultLpAccounts[index];
    if (!vaultLpAccount) throw new Error('Missing vault lp account');
    const lpSupply = new BN(u64.fromBuffer(MintLayout.decode(vaultLpAccount.data).supply));

    return { ...vaultAccountPda, vaultState, lpSupply };
  });
};

const getVaultState = async (vaultParams: TokenInfo, program: VaultProgram, seedBaseKey?: PublicKey) => {
  const { vaultPda, tokenVaultPda } = getVaultPdas(
    new PublicKey(vaultParams.address),
    new PublicKey(program.programId),
    seedBaseKey,
  );
  const vaultState = (await program.account.vault.fetchNullable(vaultPda)) as VaultState;

  if (!vaultState) {
    throw 'Cannot get vault state';
  }

  const lpSupply = await getLpSupply(program.provider.connection, vaultState.lpMint);

  return { vaultPda, tokenVaultPda, vaultState, lpSupply, lpMintPda: vaultState.lpMint };
};

const getVaultStateByPda = async (tokenInfoPda: TokenInfoPda, program: VaultProgram) => {
  const vaultState = (await program.account.vault.fetchNullable(tokenInfoPda.vaultPda)) as VaultState;

  if (!vaultState) {
    throw 'Cannot get vault state';
  }

  const lpSupply = await getLpSupply(program.provider.connection, tokenInfoPda.lpMintPda);

  return { ...tokenInfoPda, vaultState, lpSupply };
};

const getVaultLiquidity = async (connection: Connection, tokenVaultPda: PublicKey): Promise<string | null> => {
  const vaultLiquidityResponse = await connection.getAccountInfo(tokenVaultPda);
  if (!vaultLiquidityResponse) return null;

  const vaultLiquiditySerialize = deserializeAccount(vaultLiquidityResponse.data);
  return vaultLiquiditySerialize?.amount.toString() || null;
};

export default class VaultImpl implements VaultImplementation {
  private connection: Connection;
  private cluster: Cluster = 'mainnet-beta';

  // Vault
  private program: VaultProgram;
  private affiliateId: PublicKey | undefined;
  private affiliateProgram: AffiliateVaultProgram | undefined;

  private allowOwnerOffCurve?: boolean;
  public seedBaseKey?: PublicKey;

  public tokenInfo: TokenInfo;
  public vaultPda: PublicKey;
  public tokenVaultPda: PublicKey;
  public lpMintPda: PublicKey;
  public vaultState: VaultState;
  public lpSupply: BN;

  private constructor(
    program: VaultProgram,
    vaultDetails: VaultDetails,
    opt?: {
      seedBaseKey?: PublicKey;
      allowOwnerOffCurve?: boolean;
      cluster?: Cluster;
      affiliateId?: PublicKey;
      affiliateProgram?: AffiliateVaultProgram;
    },
  ) {
    this.connection = program.provider.connection;
    this.cluster = opt?.cluster ?? 'mainnet-beta';

    this.tokenInfo = vaultDetails.tokenInfo;
    this.program = program;
    this.affiliateProgram = opt?.affiliateProgram;
    this.affiliateId = opt?.affiliateId;

    this.allowOwnerOffCurve = opt?.allowOwnerOffCurve;

    this.vaultPda = vaultDetails.vaultPda;
    this.tokenVaultPda = vaultDetails.tokenVaultPda;
    this.lpMintPda = vaultDetails.lpMintPda;
    this.vaultState = vaultDetails.vaultState;
    this.lpSupply = vaultDetails.lpSupply;
  }

  public static async createPermissionlessVaultInstruction(
    connection: Connection,
    payer: PublicKey,
    tokenInfo: TokenInfo,
    opt?: {
      cluster?: Cluster;
      programId?: string;
    },
  ) {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
    const program = new Program<VaultIdl>(IDL as VaultIdl, opt?.programId || PROGRAM_ID, provider);

    const tokenMint = new PublicKey(tokenInfo.address);
    const {
      vaultPda: vault,
      tokenVaultPda: tokenVault,
      lpMintPda: lpMint,
    } = getVaultPdas(tokenMint, program.programId);

    return program.methods
      .initialize()
      .accounts({
        vault,
        payer,
        tokenVault,
        tokenMint,
        lpMint,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public static async fetchMultipleUserBalance(
    connection: Connection,
    lpMintList: Array<PublicKey>,
    owner: PublicKey,
  ): Promise<Array<BN>> {
    const ataAccounts = await Promise.all(lpMintList.map((lpMint) => getAssociatedTokenAccount(lpMint, owner)));

    const accountsInfo = await chunkedGetMultipleAccountInfos(connection, ataAccounts);

    return accountsInfo.map((accountInfo) => {
      if (!accountInfo) return new BN(0);

      const accountBalance = deserializeAccount(accountInfo.data);
      if (!accountBalance) throw new Error('Failed to parse user account for LP token.');

      return new BN(accountBalance.amount);
    });
  }

  public static async createMultiple(
    connection: Connection,
    tokenInfos: Array<TokenInfo>,
    opt?: {
      seedBaseKey?: PublicKey;
      allowOwnerOffCurve?: boolean;
      cluster?: Cluster;
      programId?: string;
      affiliateId?: PublicKey;
      affiliateProgramId?: string;
    },
  ): Promise<Array<VaultImpl>> {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
    const program = new Program<VaultIdl>(IDL as VaultIdl, opt?.programId || PROGRAM_ID, provider);

    const vaultsStateInfo = await getAllVaultState(tokenInfos, program);

    return vaultsStateInfo.map(({ vaultPda, tokenVaultPda, lpMintPda, vaultState, lpSupply }, index) => {
      const tokenInfo = tokenInfos[index];
      return new VaultImpl(
        program,
        { tokenInfo, vaultPda, tokenVaultPda, vaultState, lpSupply, lpMintPda },
        {
          ...opt,
          affiliateId: opt?.affiliateId,
          affiliateProgram: opt?.affiliateId
            ? new Program<AffiliateVaultIdl>(
                AffiliateIDL as AffiliateVaultIdl,
                opt?.affiliateProgramId || AFFILIATE_PROGRAM_ID,
                provider,
              )
            : undefined,
        },
      );
    });
  }

  public static async createMultipleWithPda(
    connection: Connection,
    tokensInfoPda: Array<TokenInfoPda>,
    opt?: {
      seedBaseKey?: PublicKey;
      allowOwnerOffCurve?: boolean;
      cluster?: Cluster;
      programId?: string;
      affiliateId?: PublicKey;
      affiliateProgramId?: string;
    },
  ): Promise<Array<VaultImpl>> {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
    const program = new Program<VaultIdl>(IDL as VaultIdl, opt?.programId || PROGRAM_ID, provider);

    const vaultsStateInfo = await getAllVaultStateByPda(tokensInfoPda, program);

    return vaultsStateInfo.map(({ vaultPda, tokenVaultPda, lpMintPda, vaultState, lpSupply }, index) => {
      const tokenInfo = tokensInfoPda[index].info;
      return new VaultImpl(
        program,
        { tokenInfo, vaultPda, tokenVaultPda, vaultState, lpSupply, lpMintPda },
        {
          ...opt,
          affiliateId: opt?.affiliateId,
          affiliateProgram: opt?.affiliateId
            ? new Program<AffiliateVaultIdl>(
                AffiliateIDL as AffiliateVaultIdl,
                opt?.affiliateProgramId || AFFILIATE_PROGRAM_ID,
                provider,
              )
            : undefined,
        },
      );
    });
  }

  public static async create(
    connection: Connection,
    tokenInfo: TokenInfo,
    opt?: {
      seedBaseKey?: PublicKey;
      allowOwnerOffCurve?: boolean;
      cluster?: Cluster;
      programId?: string;
      affiliateId?: PublicKey;
      affiliateProgramId?: string;
    },
  ): Promise<VaultImpl> {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
    const program = new Program<VaultIdl>(IDL as VaultIdl, opt?.programId || PROGRAM_ID, provider);

    const { vaultPda, tokenVaultPda, lpMintPda, vaultState, lpSupply } = await getVaultState(tokenInfo, program);
    return new VaultImpl(
      program,
      { tokenInfo, vaultPda, tokenVaultPda, vaultState, lpSupply, lpMintPda },
      {
        ...opt,
        affiliateId: opt?.affiliateId,
        affiliateProgram: opt?.affiliateId
          ? new Program<AffiliateVaultIdl>(
              AffiliateIDL as AffiliateVaultIdl,
              opt?.affiliateProgramId || AFFILIATE_PROGRAM_ID,
              provider,
            )
          : undefined,
      },
    );
  }

  public async getUserBalance(owner: PublicKey): Promise<BN> {
    const isAffiliated = this.affiliateId && this.affiliateProgram;

    const address = await (async () => {
      // User deposit directly
      if (!isAffiliated) {
        return await getAssociatedTokenAccount(this.vaultState.lpMint, owner);
      }

      // Get user affiliated address with the partner
      const { userLpToken } = await this.createAffiliateATAPreInstructions(owner);
      return userLpToken;
    })();
    const accountInfo = await this.connection.getAccountInfo(address);

    if (!accountInfo) {
      return new BN(0);
    }

    const result = deserializeAccount(accountInfo.data);
    if (result == undefined) {
      throw new Error('Failed to parse user account for LP token.');
    }

    return new BN(result.amount);
  }

  /** To refetch the latest lpSupply */
  /** Use vaultImpl.lpSupply to use cached result */
  public async getVaultSupply(): Promise<BN> {
    const lpSupply = await getLpSupply(this.connection, this.vaultState.lpMint);
    this.lpSupply = lpSupply;
    return lpSupply;
  }

  public async getWithdrawableAmount(): Promise<BN> {
    const currentTime = await getOnchainTime(this.connection);

    return calculateWithdrawableAmount(currentTime, this.vaultState);
  }

  public async refreshVaultState() {
    const { vaultState, lpSupply } = await getVaultStateByPda(
      { info: this.tokenInfo, lpMintPda: this.lpMintPda, tokenVaultPda: this.tokenVaultPda, vaultPda: this.vaultPda },
      this.program,
    );
    this.vaultState = vaultState;
    this.lpSupply = lpSupply;
  }

  private async createATAPreInstructions(owner: PublicKey) {
    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      owner,
      this.connection,
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      owner,
      this.connection,
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    return {
      preInstructions,
      userToken,
      userLpToken,
    };
  }

  private async createAffiliateATAPreInstructions(owner: PublicKey) {
    if (!this.affiliateId || !this.affiliateProgram) throw new Error('Affiliate ID or program not found');

    const partner = this.affiliateId;
    const partnerToken = await getAssociatedTokenAccount(new PublicKey(this.tokenInfo.address), partner);

    const [partnerAddress, _nonce] = PublicKey.findProgramAddressSync(
      [this.vaultPda.toBuffer(), partnerToken.toBuffer()],
      this.affiliateProgram.programId,
    );
    const [userAddress, _nonceUser] = PublicKey.findProgramAddressSync(
      [partnerAddress.toBuffer(), owner.toBuffer()],
      this.affiliateProgram.programId,
    );

    let preInstructions: TransactionInstruction[] = [];
    const [userToken, createUserTokenIx] = await getOrCreateATAInstruction(
      new PublicKey(this.tokenInfo.address),
      owner,
      this.connection,
    );
    const [userLpToken, createUserLpTokenIx] = await getOrCreateATAInstruction(
      this.vaultState.lpMint,
      userAddress,
      this.connection,
      {
        payer: owner,
      },
    );
    if (createUserTokenIx) {
      preInstructions.push(createUserTokenIx);
    }
    if (createUserLpTokenIx) {
      preInstructions.push(createUserLpTokenIx);
    }

    return {
      preInstructions,
      partner,
      partnerAddress,
      userAddress,
      userToken,
      userLpToken,
    };
  }

  public async deposit(owner: PublicKey, baseTokenAmount: BN): Promise<Transaction> {
    // Refresh vault state
    await this.refreshVaultState();

    let preInstructions: TransactionInstruction[] = [];

    let partnerAddress: PublicKey | undefined;
    let userAddress: PublicKey | undefined;
    let userToken: PublicKey | undefined;
    let userLpToken: PublicKey | undefined;

    // Withdraw with Affiliate
    if (this.affiliateId && this.affiliateProgram) {
      const {
        preInstructions: preInstructionsATA,
        partnerAddress: partnerAddressATA,
        userAddress: userAddressATA,
        userToken: userTokenATA,
        userLpToken: userLpTokenATA,
      } = await this.createAffiliateATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
      partnerAddress = partnerAddressATA;
      userAddress = userAddressATA;
    } else {
      // Without affiliate
      const {
        preInstructions: preInstructionsATA,
        userToken: userTokenATA,
        userLpToken: userLpTokenATA,
      } = await this.createATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
    }

    // If it's SOL vault, wrap desired amount of SOL
    if (this.tokenInfo.address === NATIVE_MINT.toString()) {
      preInstructions = preInstructions.concat(wrapSOLInstruction(owner, userToken, baseTokenAmount));
    }

    let depositTx: Transaction;
    if (partnerAddress && userAddress && this.affiliateId && this.affiliateProgram) {
      const userPda = await this.connection.getParsedAccountInfo(userAddress);
      if (!userPda || !userPda.value?.data) {
        // Init first time user
        preInstructions.push(
          await this.affiliateProgram.methods
            .initUser()
            .accounts({
              user: userAddress,
              partner: partnerAddress,
              owner,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction(),
        );
      }

      depositTx = await this.affiliateProgram.methods
        .deposit(new BN(baseTokenAmount.toString()), new BN(0)) // Vault does not have slippage, second parameter is ignored.
        .accounts({
          partner: partnerAddress,
          user: userAddress,
          vaultProgram: this.program.programId,
          vault: this.vaultPda,
          tokenVault: this.tokenVaultPda,
          vaultLpMint: this.vaultState.lpMint,
          userToken,
          userLp: userLpToken,
          owner,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .transaction();
    } else {
      depositTx = await this.program.methods
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
        .transaction();
    }
    return new Transaction({ feePayer: owner, ...(await this.connection.getLatestBlockhash()) }).add(depositTx);
  }

  public async getStrategiesState(): Promise<Array<StrategyState>> {
    return (
      await this.program.account.strategy.fetchMultiple(
        this.vaultState.strategies.filter((address) => address.toString() !== VAULT_STRATEGY_ADDRESS),
      )
    ).filter(Boolean);
  }

  private async getStrategyWithHighestLiquidity(strategy?: PublicKey) {
    // Reserved for testing
    if (strategy) {
      const strategyState = (await this.program.account.strategy.fetchNullable(strategy)) as unknown as StrategyState;
      return { publicKey: strategy, strategyState };
    }

    const vaultStrategiesStatePromise = this.vaultState.strategies
      .filter((address) => address.toString() !== VAULT_STRATEGY_ADDRESS)
      .map(async (strat) => {
        const strategyState = (await this.program.account.strategy.fetch(strat)) as unknown as StrategyState;
        return { publicKey: strat, strategyState };
      });
    const vaultStrategiesState = await Promise.allSettled(vaultStrategiesStatePromise);
    const settledVaultStrategiesState = vaultStrategiesState
      .map((item) => (item.status === 'fulfilled' ? item.value : undefined))
      .filter(Boolean);

    const highestLiquidity = settledVaultStrategiesState.sort((a, b) =>
      b.strategyState.currentLiquidity.sub(a.strategyState.currentLiquidity).toNumber(),
    )[0];
    return highestLiquidity;
  }

  public async withdraw(owner: PublicKey, baseTokenAmount: BN, opt?: { strategy?: PublicKey }): Promise<Transaction> {
    // Refresh vault state
    await this.refreshVaultState();
    const lpSupply = await this.getVaultSupply();

    let preInstructions: TransactionInstruction[] = [];
    let userToken: PublicKey | undefined;
    let userLpToken: PublicKey | undefined;
    let withdrawOpt: WithdrawOpt | undefined;

    // Withdraw with Affiliate
    if (this.affiliateId && this.affiliateProgram) {
      const {
        preInstructions: preInstructionsATA,
        partnerAddress,
        userAddress,
        userToken: userTokenATA,
        userLpToken: userLpTokenATA,
      } = await this.createAffiliateATAPreInstructions(owner);

      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
      withdrawOpt =
        this.affiliateId && this.affiliateProgram
          ? {
              affiliate: {
                affiliateId: this.affiliateId,
                affiliateProgram: this.affiliateProgram,
                partner: partnerAddress,
                user: userAddress,
              },
            }
          : undefined;
    } else {
      // Without affiliate
      const {
        preInstructions: preInstructionsATA,
        userToken: userTokenATA,
        userLpToken: userLpTokenATA,
      } = await this.createATAPreInstructions(owner);
      preInstructions = preInstructionsATA;
      userToken = userTokenATA;
      userLpToken = userLpTokenATA;
    }

    const unlockedAmount = await this.getWithdrawableAmount();
    const amountToWithdraw = baseTokenAmount.mul(unlockedAmount).div(lpSupply);
    const vaultLiquidity = new BN((await getVaultLiquidity(this.connection, this.tokenVaultPda)) || 0);

    if (
      amountToWithdraw.lt(vaultLiquidity) // If withdraw amount lesser than vault reserve
    ) {
      return this.withdrawFromVaultReserve(
        owner,
        baseTokenAmount,
        userToken,
        userLpToken,
        preInstructions,
        withdrawOpt,
      );
    }

    // Get strategy with highest liquidity
    // opt.strategy reserved for testing
    const selectedStrategy = await this.getStrategyWithHighestLiquidity(opt?.strategy);

    const currentLiquidity = new BN(selectedStrategy.strategyState.currentLiquidity);
    const availableAmount = currentLiquidity.add(vaultLiquidity);

    if (amountToWithdraw.gt(availableAmount)) {
      throw new Error('Selected strategy does not have enough liquidity.');
    }

    const strategyType = getStrategyType(selectedStrategy.strategyState.strategyType);
    const strategyHandler = getStrategyHandler(strategyType, this.cluster, this.program);

    if (!strategyType || !strategyHandler) {
      throw new Error('Cannot find strategy handler');
    }

    // Unwrap SOL
    const postInstruction: Array<TransactionInstruction> = [];
    if (this.tokenInfo.address === NATIVE_MINT.toString()) {
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
      this.vaultState,
      userToken,
      userLpToken,
      baseTokenAmount,
      preInstructions,
      postInstruction,
      withdrawOpt,
    );

    const tx = new Transaction({ feePayer: owner, ...(await this.connection.getLatestBlockhash()) }).add(
      withdrawFromStrategyTx,
    );

    return tx;
  }

  // Reserved code to withdraw from Vault Reserves directly.
  // The only situation this piece of code will be required, is when a single Vault have no other strategy, and only have its own reserve.
  private async withdrawFromVaultReserve(
    owner: PublicKey,
    baseTokenAmount: BN,
    userToken: PublicKey,
    userLpToken: PublicKey,
    preInstructions: Array<TransactionInstruction>,
    withdrawOpt?: WithdrawOpt,
  ): Promise<Transaction> {
    // Unwrap SOL
    const postInstruction: Array<TransactionInstruction> = [];
    if (this.tokenInfo.address === NATIVE_MINT.toString()) {
      const closeWrappedSOLIx = await unwrapSOLInstruction(owner);
      if (closeWrappedSOLIx) {
        postInstruction.push(closeWrappedSOLIx);
      }
    }

    let withdrawTx;
    if (withdrawOpt?.affiliate) {
      withdrawTx = await withdrawOpt.affiliate.affiliateProgram.methods
        .withdraw(baseTokenAmount, new BN(0))
        .accounts({
          vault: this.vaultPda,
          tokenVault: this.tokenVaultPda,
          vaultLpMint: this.vaultState.lpMint,
          partner: withdrawOpt.affiliate.partner,
          owner,
          userToken,
          vaultProgram: this.program.programId,
          userLp: userLpToken,
          user: withdrawOpt.affiliate.user,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .postInstructions(postInstruction)
        .transaction();
    } else {
      withdrawTx = await this.program.methods
        .withdraw(baseTokenAmount, new BN(0)) // Vault does not have slippage, second parameter is ignored.
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
        .transaction();
    }

    return new Transaction({ feePayer: owner, ...(await this.connection.getLatestBlockhash()) }).add(withdrawTx);
  }

  public async getAffiliateInfo(): Promise<AffiliateInfo> {
    if (!this.affiliateId || !this.affiliateProgram) throw new Error('No affiliateId or affiliate program found');

    const partner = this.affiliateId;
    const partnerToken = await getAssociatedTokenAccount(new PublicKey(this.tokenInfo.address), partner);

    const [partnerAddress, _nonce] = PublicKey.findProgramAddressSync(
      [this.vaultPda.toBuffer(), partnerToken.toBuffer()],
      this.affiliateProgram.programId,
    );

    const partnerDetails = (await this.affiliateProgram.account.partner.fetchNullable(partnerAddress)) as AffiliateInfo;
    return partnerDetails;
  }
}
