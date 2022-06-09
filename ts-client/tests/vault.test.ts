import { Connection, Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY, ParsedAccountData } from "@solana/web3.js";
import { StaticTokenListResolutionStrategy, TokenInfo } from "@solana/spl-token-registry";
import { Wallet, AnchorProvider } from "@project-serum/anchor";

import Vault from "../src/vault";
import { SOL_MINT } from "../src/constants";
import { ParsedClockState } from "../types/clock_state";
import { airDropSol } from './utils';

const mockWallet = new Wallet(new Keypair());
const mainnetConnection = new Connection("https://api.mainnet-beta.solana.com");
const devnetConnection = new Connection("https://api.devnet.solana.com/");


// Prevent importing directly from .json, causing slowdown on Intellisense
const SOL_TOKEN_INFO = (
  new StaticTokenListResolutionStrategy()
  .resolve()
  .find(token => token.symbol === 'SOL')
) as TokenInfo; // Guaranteed to exist
let currentTime = 0;

beforeAll(async () => {
  await airDropSol(devnetConnection, mockWallet.publicKey);

  const parsedClock = await mainnetConnection.getParsedAccountInfo(
    SYSVAR_CLOCK_PUBKEY
  );
  const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData)
    .parsed as ParsedClockState;
  currentTime = parsedClockAccount.info.unixTimestamp; // use on-chain time instead of local time
  console.log("current time: ", currentTime);
})

describe('Get Mainnet vault state', () => {
  const provider = new AnchorProvider(mainnetConnection, mockWallet, {
    commitment: "processed",
  });
  const vault = new Vault(provider, mockWallet.publicKey);

  let lpSupply;
  beforeAll(async () => {
    await vault.init(SOL_MINT);
    if (!vault.state) return;

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

describe('Interact with Vault in devnet', () => {
  const provider = new AnchorProvider(devnetConnection, mockWallet, {
    commitment: "confirmed",
  });
  const vault = new Vault(provider, mockWallet.publicKey);

  test("Vault Withdraw SOL", async () => {
    const depositResult = await vault.deposit(SOL_TOKEN_INFO, 2000);
    expect(typeof depositResult).toBe("string");
    const withdrawResult = await vault.withdraw(SOL_TOKEN_INFO, 1000);
    expect(typeof withdrawResult).toBe("string");
  });

  test("Vault Withdraw SOL from strategy", async () => {
    await vault.init(SOL_MINT);
    if (!vault.state) return;
    
    for (var strategy of vault.state.strategies) {
      if (!strategy.equals(PublicKey.default)) {
        console.log("Test with ", strategy.toString());
        const depositResult = await vault.deposit(SOL_TOKEN_INFO, 2000);
        expect(typeof depositResult).toBe("string");
        const withdrawResult = await vault.withdrawFromStrategy(SOL_TOKEN_INFO, strategy, 1000);
        expect(typeof withdrawResult).toBe("string");
      }
    }
  });
})
