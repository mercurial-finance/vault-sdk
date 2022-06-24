import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi";

export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// Mainnet addresses
export const MAINNET_VAULT_MINTS = Object.freeze({
  SOL_MINT,
  USDC_MINT: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  USDT_MINT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
});

export const DEVNET_VAULT_MINTS = Object.freeze({
  SOL_MINT,
  USDC_MINT: new PublicKey("zVzi5VAf4qMEwzv7NXECVx5v2pQ7xnqVVjCXZwS9XzA"),
  USDT_MINT: new PublicKey("9NGDi2tZtNmCCp8SVLKNuGjuWAVwNF3Vap5tT8km5er9"),
});

export const STRATEGY_PROGRAM_ADDRESSES: {
  solend: PublicKey;
  portFinance: PublicKey;
} = {
  solend: new PublicKey("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx"),
  portFinance: new PublicKey("pdQ2rQQU5zH2rDgZ7xH2azMBJegUzUyunJ5Jd637hC4"),
};
