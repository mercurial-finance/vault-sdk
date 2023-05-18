import {
  AccountMeta,
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';

import { SEEDS } from '../constants';
import { AffiliateVaultProgram, VaultProgram, VaultState } from '../types';
import { Strategy, StrategyHandler } from '.';
import {
  AccountType,
  MarginfiAccount,
  MarginfiClient,
  PDA_BANK_FEE_VAULT_AUTH_SEED,
  PDA_BANK_FEE_VAULT_SEED,
  getConfig,
} from '@mercurial-finance/marginfi-client-v2';
import { getOrCreateATAInstruction } from '../utils';

export default class MarginFiHandler implements StrategyHandler {
  private connection: Connection;

  constructor(program: VaultProgram) {
    this.connection = program.provider.connection;
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

    const marginfiClient = await MarginfiClient.fetch(getConfig(), {} as any, this.connection);

    const strategyBuffer = new PublicKey(strategy.pubkey).toBuffer();
    const [marginfiPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.MARGINFI_ACCOUNT), strategyBuffer],
      program.programId,
    );

    const marginfiAccount = await MarginfiAccount.fetch(marginfiPda, marginfiClient);
    const group = marginfiAccount.group;

    const bank = group.getBankByMint(vaultState.tokenMint);

    if (!bank) throw new Error('No bank found');

    const [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COLLATERAL_VAULT_PREFIX), strategyBuffer],
      program.programId,
    );

    const [strategyOwner] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.MARGINFI_STRATEGY), strategyBuffer],
      program.programId,
    );

    const [tokenAccount, createTokenAccountIx] = await getOrCreateATAInstruction(
      vaultState.tokenMint,
      strategyOwner,
      this.connection,
      {
        payer: walletPubKey,
      },
    );
    createTokenAccountIx && preInstructions.push(createTokenAccountIx);

    const [bankLiquidityVault] = PublicKey.findProgramAddressSync(
      [PDA_BANK_FEE_VAULT_SEED, strategyBuffer],
      marginfiClient.programId,
    );
    const [bankLiquidityVaultAuth] = PublicKey.findProgramAddressSync(
      [PDA_BANK_FEE_VAULT_AUTH_SEED, strategyBuffer],
      marginfiClient.programId,
    );

    const observationAccounts = marginfiAccount.getHealthCheckAccounts([bank]);

    const accounts = [
      { pubkey: strategyOwner },
      { pubkey: bank.group },
      { pubkey: marginfiAccount.publicKey },
      { pubkey: tokenAccount },
      { pubkey: bankLiquidityVault },
      { pubkey: bankLiquidityVaultAuth },
      ...observationAccounts,
    ];

    const remainingAccounts: Array<AccountMeta> = [];
    for (const account of accounts) {
      remainingAccounts.push({
        pubkey: account.pubkey,
        isWritable: false,
        isSigner: false,
      });
    }

    // prevent duplicate as spot market account pubkey will be add on program side
    const remainingAccountsWithoutReserve = remainingAccounts.filter(
      ({ pubkey }) => !pubkey.equals(strategy.state.reserve),
    );

    const txAccounts = {
      vault,
      strategy: new PublicKey(strategy.pubkey),
      reserve: new PublicKey(strategy.state.reserve),
      strategyProgram: marginfiClient.programId,
      collateralVault,
      feeVault: vaultState.feeVault,
      tokenVault,
      userToken,
      userLp,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

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
        .remainingAccounts(remainingAccountsWithoutReserve)
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
      .remainingAccounts(remainingAccountsWithoutReserve)
      .preInstructions(preInstructions)
      .postInstructions(postInstructions)
      .transaction();

    return tx;
  }
}
