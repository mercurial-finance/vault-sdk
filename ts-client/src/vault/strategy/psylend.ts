import {
  PublicKey,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
  Transaction,
  Connection,
  Cluster,
} from '@solana/web3.js';
import { IDL as PsyLendIDL, Psylend, keys, instructions } from '@mithraic-labs/psylend-utils';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN, Program, AnchorProvider } from '@project-serum/anchor';

import { StrategyHandler, Strategy } from '.';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { SEEDS } from '../constants';
import { getOrCreateATAInstruction } from '../utils';

export default class PsyLendHandler implements StrategyHandler {
  private connection: Connection;
  private cluster: Cluster;
  private psyLendProgram: Program<Psylend>;

  constructor(cluster: Cluster, program: VaultProgram) {
    this.cluster = cluster;
    this.connection = program.provider.connection;
    this.psyLendProgram = new Program<Psylend>(
      PsyLendIDL,
      keys.psyLendMainnetProgramKey,
      new AnchorProvider(program.provider.connection, {} as any, AnchorProvider.defaultOptions()),
    );
  }

  async withdraw(
    walletPubKey: PublicKey,
    program: VaultProgram,
    strategy: Strategy,
    vault: PublicKey,
    tokenVault: PublicKey,
    vaultState: VaultState,
    userToken: PublicKey,
    userLp: PublicKey,
    amount: BN,
    preInstructions: TransactionInstruction[],
    postInstructions: TransactionInstruction[],
    opt?: {
      affiliate?: {
        affiliateId: PublicKey;
        affiliateProgram: AffiliateVaultProgram;
        partner: PublicKey;
        user: PublicKey;
      };
    },
  ): Promise<Transaction> {
    if (!walletPubKey) throw new Error('No user wallet public key');

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const { reserve } = strategy.state;
    const reserveState = await this.psyLendProgram.account.reserve.fetchNullable(reserve);
    if (!reserveState) throw new Error('No user reserve account');
    const { market, depositNoteMint, pythOraclePrice, feeNoteVault, vault: reserveVault } = reserveState;

    const marketState = await this.psyLendProgram.account.market.fetchNullable(market);
    if (!marketState) throw new Error('No user reserve market account');
    const { marketAuthority } = marketState;

    const [strategyOwnerPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.PSYLEND), strategyBuffer],
      program.programId,
    );

    const [strategyOwnerAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.PSYLEND_OWNER), reserve.toBuffer(), strategyOwnerPubkey.toBuffer()],
      keys.psyLendMainnetProgramKey,
    );

    const [tokenAccount, createTokenAccountIx] = await getOrCreateATAInstruction(
      vaultState.tokenMint,
      strategyOwnerPubkey,
      this.connection,
      {
        payer: walletPubKey,
      },
    );
    createTokenAccountIx && preInstructions.push(createTokenAccountIx);

    const accounts = [
      { pubkey: market, isWritable: true },
      { pubkey: marketAuthority, isWritable: true },
      { pubkey: strategyOwnerAccount, isWritable: true },
      { pubkey: strategyOwnerPubkey, isWritable: true },
      { pubkey: reserveVault, isWritable: true },
      { pubkey: depositNoteMint, isWritable: true },
      { pubkey: tokenAccount, isWritable: true },
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accounts) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: true,
        isSigner: false,
      });
    }

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: keys.psyLendMainnetProgramKey,
      collateralVault,
      feeVault: vaultState.feeVault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    const accrueInterestIx = await instructions.accrueInterestIx(
      this.psyLendProgram,
      market,
      marketAuthority,
      reserve,
      feeNoteVault,
      depositNoteMint,
    );
    preInstructions.push(accrueInterestIx);

    const refreshReserveIx = await instructions.refreshReserveIx(this.psyLendProgram, market, reserve, pythOraclePrice);
    preInstructions.push(refreshReserveIx);

    if (opt?.affiliate) {
      const tx = await opt.affiliate.affiliateProgram.methods
        .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
        .accounts({
          ...txAccounts,
          partner: opt.affiliate.partner,
          user: opt.affiliate.user,
          vaultProgram: program.programId,
          vaultLpMint: vaultState.lpMint,
          owner: walletPubKey,
        })
        .remainingAccounts(remainingAccounts)
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction();

      return tx;
    }

    const tx = await program.methods
      .withdrawDirectlyFromStrategy(new BN(amount), new BN(0))
      .accounts({
        ...txAccounts,
        lpMint: vaultState.lpMint,
        user: walletPubKey,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
