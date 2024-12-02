import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  RawAccount,
  AccountLayout,
  MintLayout,
  RawMint,
} from '@solana/spl-token';
import {
  Connection,
  ParsedAccountData,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

import { SEEDS, VAULT_BASE_KEY } from '../constants';
import { ParsedClockState, VaultProgram } from '../types';

export const getAssociatedTokenAccount = (tokenMint: PublicKey, owner: PublicKey) => {
  return getAssociatedTokenAddressSync(tokenMint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
};

export const deserializeAccount = (data: Buffer | undefined): RawAccount | undefined => {
  if (data == undefined || data.length == 0) {
    return undefined;
  }
  const accountInfo = AccountLayout.decode(data);
  return accountInfo;
};

export const deserializeMint = (data: Buffer | undefined): RawMint | undefined => {
  if (data == undefined || data.length == 0) {
    return undefined;
  }
  const mintInfo = MintLayout.decode(data);
  return mintInfo;
};

export const getOrCreateATAInstruction = async (
  tokenAddress: PublicKey,
  owner: PublicKey,
  connection: Connection,
  opt?: {
    payer?: PublicKey;
  },
): Promise<[PublicKey, TransactionInstruction?]> => {
  let toAccount;
  try {
    toAccount = getAssociatedTokenAddressSync(tokenAddress, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const account = await connection.getAccountInfo(toAccount);
    if (!account) {
      const ix = createAssociatedTokenAccountInstruction(
        opt?.payer || owner,
        toAccount,
        owner,
        tokenAddress,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      return [toAccount, ix];
    }
    return [toAccount, undefined];
  } catch (e) {
    /* handle error */
    console.error('Error::getOrCreateATAInstruction', e);
    throw e;
  }
};

export const getVaultPdas = (tokenMint: PublicKey, programId: PublicKey, seedBaseKey?: PublicKey) => {
  const [vault, _vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT_PREFIX), tokenMint.toBuffer(), (seedBaseKey ?? VAULT_BASE_KEY).toBuffer()],
    programId,
  );

  const [tokenVault] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.TOKEN_VAULT_PREFIX), vault.toBuffer()],
    programId,
  );
  const [lpMint] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.LP_MINT_PREFIX), vault.toBuffer()], programId);

  return {
    vaultPda: vault,
    tokenVaultPda: tokenVault,
    lpMintPda: lpMint,
  };
};

export const wrapSOLInstruction = (from: PublicKey, to: PublicKey, amount: BN): TransactionInstruction[] => {
  return [
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: amount.toNumber(),
    }),
    new TransactionInstruction({
      keys: [
        {
          pubkey: to,
          isSigner: false,
          isWritable: true,
        },
      ],
      data: Buffer.from(new Uint8Array([17])),
      programId: TOKEN_PROGRAM_ID,
    }),
  ];
};

export const unwrapSOLInstruction = async (walletPublicKey: PublicKey) => {
  const wSolATAAccount = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    walletPublicKey,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  if (wSolATAAccount) {
    const closedWrappedSolInstruction = createCloseAccountInstruction(
      wSolATAAccount,
      walletPublicKey,
      walletPublicKey,
      [],
    );
    return closedWrappedSolInstruction;
  }
  return null;
};

export const getOnchainTime = async (connection: Connection) => {
  const parsedClock = await connection.getParsedAccountInfo(SYSVAR_CLOCK_PUBKEY);

  const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData).parsed as ParsedClockState;

  const currentTime = parsedClockAccount.info.unixTimestamp;
  return currentTime;
};

export const getLpSupply = async (connection: Connection, tokenMint: PublicKey): Promise<BN> => {
  const context = await connection.getTokenSupply(tokenMint);
  return new BN(context.value.amount);
};

export function chunks<T>(array: T[], size: number): T[][] {
  return Array.apply(0, new Array(Math.ceil(array.length / size))).map((_, index) =>
    array.slice(index * size, (index + 1) * size),
  );
}

export async function chunkedFetchMultipleVaultAccount(
  program: VaultProgram,
  pks: PublicKey[],
  chunkSize: number = 100,
) {
  const accounts = (
    await Promise.all(chunks(pks, chunkSize).map((chunk) => program.account.vault.fetchMultiple(chunk)))
  ).flat();

  return accounts.filter(Boolean);
}

export async function chunkedGetMultipleAccountInfos(
  connection: Connection,
  pks: PublicKey[],
  chunkSize: number = 100,
) {
  const accountInfos = (
    await Promise.all(chunks(pks, chunkSize).map((chunk) => connection.getMultipleAccountsInfo(chunk)))
  ).flat();

  return accountInfos;
}
