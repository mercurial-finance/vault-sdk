import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import SolanaTokenList from "@solana/spl-token-registry/dist/module/tokens/solana.tokenlist.json";
import { Wallet, Provider } from "@project-serum/anchor";

import Vault from "../src/vault";
import { SOL_MINT } from "../src/constants";
import { airDropSol } from './utils';

const mockWallet = new Wallet(new Keypair());
const mainnetConnection = new Connection("https://api.mainnet-beta.solana.com");
const devnetConnection = new Connection("https://api.devnet.solana.com/");
const SOL_TOKEN_INFO = SolanaTokenList.tokens.find(token => token.symbol === 'SOL');

beforeAll(async () => {
  await airDropSol(devnetConnection, mockWallet.publicKey);
})

describe('Get Mainnet vault state', () => {
  const provider = new Provider(mainnetConnection, mockWallet, {
    commitment: "processed",
  });
  const vault = new Vault(provider);
  
  const currentTime = Math.floor(Date.now() / 1000);
  let lpSupply;
  beforeAll(async () => {
    await vault.getVaultStateByMint(SOL_MINT);
    lpSupply = (await mainnetConnection.getTokenSupply(vault.state.lpMint)).value.amount;
  })

  test("lp supply", async () => {
    expect(typeof lpSupply).toBe("string");
  });

  test("get unlocked amount", async () => {
    const unlockedAmount = vault.getUnlockedAmount(currentTime);
    expect(typeof unlockedAmount).toBe("number");
  })

  test("get amount by share", async () => {
    const amountByShare = vault.getAmountByShare(
      currentTime,
      100_000_000,
      lpSupply
    );
    expect(typeof amountByShare).toBe("number");
  })

  test("get unmint amount", async () => {
    const unMintAmount = vault.getUnmintAmount(
      currentTime,
      100_000_000,
      lpSupply
    );
    expect(typeof unMintAmount).toBe("number");
  })
})

describe('Interact with Vault', () => {
  const provider = new Provider(devnetConnection, mockWallet, {
    commitment: "confirmed",
  });
  const vault = new Vault(provider);

  test("Vault Withdraw SOL", async () => {
    const depositResult = await vault.deposit(SOL_TOKEN_INFO, 2000);
    expect(typeof depositResult).toBe("string");
    const withdrawResult = await vault.withdraw(SOL_TOKEN_INFO, 1000);
    expect(typeof withdrawResult).toBe("string");
  });

  test("Vault Withdraw SOL from strategy", async () => {
    await vault.getVaultStateByMint(SOL_MINT);
    for (var strategy of vault.state.strategies) {
      if (!strategy.equals(PublicKey.default)) {
        console.log("Test with ", strategy.toString());
        const depositResult = await vault.deposit(SOL_TOKEN_INFO, 2000);
        expect(typeof depositResult).toBe("string");
        const withdrawResult = await vault.withdrawFromStrategy(SOL_TOKEN_INFO,strategy, 1000);
        expect(typeof withdrawResult).toBe("string");
      }
    }
  });
})
