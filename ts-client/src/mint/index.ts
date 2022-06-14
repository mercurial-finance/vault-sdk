import { PublicKey } from '@solana/web3.js';

import { StrategyState, StrategyHandler } from '../strategy';

export type Strategy = {
  pubkey: PublicKey;
  state: StrategyState;
};

export interface VaultCoin {  
  deposit(amount: number): Promise<string>;
  withdraw(unmintAmount: number): Promise<string>;
  withdrawFromStrategy(strategy: Strategy, strategyHandler: StrategyHandler, unmintAmount: number): Promise<string>;
}
