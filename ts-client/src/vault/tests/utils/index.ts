import { Connection, PublicKey } from '@solana/web3.js';

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
