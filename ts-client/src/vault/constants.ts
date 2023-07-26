import { Cluster, PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

export const PROGRAM_ID = '24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi';
export const AFFILIATE_PROGRAM_ID = 'GacY9YuN16HNRTy7ZWwULPccwvfFSBeNLuAQP7y38Du3';

export const REWARDER = 'GuHrjvzqDvLTB27ebd9iFKwceCxKvSswzTByDQUTsvdm';

// Mainnet addresses
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

export const VAULT_BASE_KEY = new PublicKey('HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv');

export const SEEDS = Object.freeze({
  VAULT_PREFIX: 'vault',
  TOKEN_VAULT_PREFIX: 'token_vault',
  LP_MINT_PREFIX: 'lp_mint',
  COLLATERAL_VAULT_PREFIX: 'collateral_vault',
  OBLIGATION_PREFIX: 'obligation',
  OBLIGATION_OWNER_PREFIX: 'obligation_owner',
  STAKING_PREFIX: 'staking',
  MINER: 'Miner',
  QUARRY: 'Quarry',
  APRICOT_USER_INFO_SIGNER_PREFIX: 'apricot_user_info_signer',
  FRAKT: 'frakt',
  DEPOSIT: 'deposit',
  FRAKT_LENDING: 'nftlendingv2',
  CYPHER: 'cypher',
  MANGO_ACCOUNT: 'MangoAccount',
  MANGO: 'mango',
  PSYLEND: 'psylend',
  PSYLEND_OWNER: 'deposits',
  MARGINFI_STRATEGY: 'marginfi_strategy',
  MARGINFI_ACCOUNT: 'marginfi_account',
});

export const StrategyProgram: Record<
  Cluster,
  {
    solend: PublicKey;
    portFinance: PublicKey;
  }
> = {
  testnet: {
    solend: new PublicKey('ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx'),
    portFinance: new PublicKey('pdQ2rQQU5zH2rDgZ7xH2azMBJegUzUyunJ5Jd637hC4'),
  },
  devnet: {
    solend: new PublicKey('ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx'),
    portFinance: new PublicKey('pdQ2rQQU5zH2rDgZ7xH2azMBJegUzUyunJ5Jd637hC4'),
  },
  'mainnet-beta': {
    solend: new PublicKey('So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'),
    portFinance: new PublicKey('Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR'),
  },
};

export const KEEPER_URL: Record<Cluster, string> = {
  testnet: 'https://staging-keeper.raccoons.dev',
  devnet: 'https://dev-keeper.raccoons.dev',
  'mainnet-beta': 'https://merv2-api.mercurial.finance',
};

export const VAULT_STRATEGY_ADDRESS = '11111111111111111111111111111111';
export const LOCKED_PROFIT_DEGRADATION_DENOMINATOR = new BN(1_000_000_000_000);
