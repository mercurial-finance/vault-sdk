import { PublicKey } from "@solana/web3.js";

export const BASE_KEY = Object.freeze({
  VAULT: new PublicKey("HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv"),
});

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
