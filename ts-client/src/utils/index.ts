import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  Token,
} from "@solana/spl-token";
import { SOL_MINT } from "../constants/vault";

export const fromDecimal = (amount: number, decimal: number) => {
  return amount / Math.pow(10, decimal);
};

export const toDecimal = (amount: number, decimal: number) => {
  return amount * Math.pow(10, decimal);
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

export const wrapSOLInstruction = (
  from: PublicKey,
  to: PublicKey,
  amount: number
): TransactionInstruction[] => {
  return [
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: amount,
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

export const createCloseAccountTransaction = async (
  walletPublicKey: PublicKey
) => {
  const wSolATAAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    SOL_MINT,
    walletPublicKey
  );

  if (wSolATAAccount) {
    const closedWrappedSolInstruction = Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      wSolATAAccount,
      walletPublicKey,
      walletPublicKey,
      []
    );
    return closedWrappedSolInstruction;
  }
  return null;
};
