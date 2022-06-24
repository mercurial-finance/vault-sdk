import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi";

// Mainnet addresses
export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
export const USDT_MINT = new PublicKey(
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
);

export const VAULT_BASE_KEY = new PublicKey(
  "HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv"
);

export const SEEDS = Object.freeze({
  VAULT_PREFIX: "vault",
  TOKEN_VAULT_PREFIX: "token_vault",
  LP_MINT_PREFIX: "lp_mint",
  COLLATERAL_VAULT_PREFIX: "collateral_vault",
  OBLIGATION_PREFIX: "obligation",
  OBLIGATION_OWNER_PREFIX: "obligation_owner",
  STAKING_PREFIX: "staking",
  MINER: "Miner",
});

export const STRATEGY_PROGRAM_ADDRESSES: {
  solend: PublicKey;
  portFinance: PublicKey;
} = {
  solend: new PublicKey("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx"),
  portFinance: new PublicKey("pdQ2rQQU5zH2rDgZ7xH2azMBJegUzUyunJ5Jd637hC4"),
};