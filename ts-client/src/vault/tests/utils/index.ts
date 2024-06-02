import { Connection, PublicKey } from '@solana/web3.js';
import { TokenInfo } from '../../types';

const LAMPORTS_PER_SOL = 1e9;
export const airDropSol = async (connection: Connection, publicKey: PublicKey, amount = 1 * LAMPORTS_PER_SOL) => {
  try {
    const airdropSignature = await connection.requestAirdrop(publicKey, amount);
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export async function getValidatedTokens(): Promise<TokenInfo[]> {
  try {
    const tokensList: TokenInfo[] = [];
    const data = await fetch(`https://token.jup.ag/strict`)
    const tokens = await data.json()
    tokens.forEach((token: TokenInfo) => {
      tokensList.push(token);
    });
    return tokensList;
  } catch (error: any) {
    throw new Error("Failed to fetch validated tokens");
  }
};
