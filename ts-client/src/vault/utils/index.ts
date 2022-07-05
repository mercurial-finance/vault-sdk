import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, ParsedAccountData, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { AccountInfo, AccountLayout, u64 } from '@solana/spl-token';
import { BN } from '@project-serum/anchor'

import { SOL_MINT, VAULT_BASE_KEY } from "../constants";
import { ParsedClockState } from "../types";

export const getAssociatedTokenAccount = async (tokenMint: PublicKey, owner: PublicKey) => {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    tokenMint,
    owner,
  );
}

export const deserializeAccount = (data: Buffer | undefined): AccountInfo | undefined => {
  if (data == undefined || data.length == 0) {
    return undefined;
  }

  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  if (accountInfo.delegateOption === 0) {
    accountInfo.delegate = null;
    accountInfo.delegatedAmount = new u64(0);
  } else {
    accountInfo.delegate = new PublicKey(accountInfo.delegate);
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  accountInfo.isInitialized = accountInfo.state !== 0;
  accountInfo.isFrozen = accountInfo.state === 2;

  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    accountInfo.isNative = true;
  } else {
    accountInfo.rentExemptReserve = null;
    accountInfo.isNative = false;
  }

  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null;
  } else {
    accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
  }

  return accountInfo;
};

export const getOrCreateATAInstruction = async (
  tokenMint: PublicKey,
  owner: PublicKey,
  connection: Connection
): Promise<[PublicKey, TransactionInstruction?]> => {
  let toAccount;
  try {
    toAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      tokenMint,
      owner
    );
    const account = await connection.getAccountInfo(toAccount);
    if (!account) {
      const ix = Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        tokenMint,
        toAccount,
        owner,
        owner
      );
      return [toAccount, ix];
    }
    return [toAccount, undefined];
  } catch (e) {
    /* handle error */
    console.error("Error::getOrCreateATAInstruction", e);
    throw e;
  }
};

export const getVaultPdas = async (
  tokenMint: PublicKey,
  programId: PublicKey
) => {
  const [vault, _vaultBump] = await PublicKey.findProgramAddress(
    [Buffer.from("vault"), tokenMint.toBuffer(), VAULT_BASE_KEY.toBuffer()],
    programId
  );

  const [tokenVault, lpMint] = await Promise.all([
    PublicKey.findProgramAddress(
      [Buffer.from("token_vault"), vault.toBuffer()],
      programId
    ),
    PublicKey.findProgramAddress(
      [Buffer.from("lp_mint"), vault.toBuffer()],
      programId
    ),
  ]);

  return {
    vaultPda: vault,
    tokenVaultPda: tokenVault[0],
    lpMintPda: lpMint[0],
  };
};

export const wrapSOLInstruction = (
  from: PublicKey,
  to: PublicKey,
  amount: BN
): TransactionInstruction[] => {
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
  const wSolATAAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    SOL_MINT,
    walletPublicKey,
  );

  if (wSolATAAccount) {
    const closedWrappedSolInstruction = Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
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
  const parsedClock = await connection.getParsedAccountInfo(
    SYSVAR_CLOCK_PUBKEY
  );

  const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData)
    .parsed as ParsedClockState;

  const currentTime = parsedClockAccount.info.unixTimestamp;
  return currentTime;
}

export const getLpSupply = async (connection: Connection, tokenMint: PublicKey): Promise<BN> => {
  const context = await connection.getTokenSupply(tokenMint);
  return new BN(context.value.amount)
}
