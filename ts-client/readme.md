# Mercurial Vault SDK

## Install

1. Install deps 
```
npm i @mercurial-finance/vault-sdk @project-serum/anchor @solana/web3.js
```
2. Setup the required parameters, and init the instance

```ts
import Vault from "@mercurial-finance/vault-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  ParsedAccountData,
} from "@solana/web3.js";
import { Wallet, AnchorProvider } from "@project-serum/anchor";

const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

async function main() {
  const mockWallet = new Wallet(new Keypair()); // Or real wallet private key
  const mainnetConnection = new Connection(
    "https://api.mainnet-beta.solana.com"
  );
  const provider = new AnchorProvider(mainnetConnection, mockWallet, {
    commitment: "processed",
  });

  const vault = new Vault(provider, mockWallet.publicKey);
  await vault.init(SOL_MINT);
}

main();
```

<br>

---

<br>

## Reading Vault's state
<br>

### Getting started 
How to get on chain time

```ts
import { SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";

const parsedClock = await mainnetConnection.getParsedAccountInfo(
  SYSVAR_CLOCK_PUBKEY
);

const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData)
  .parsed as ParsedClockState;

const currentTime = parsedClockAccount.info.unixTimestamp; // use on-chain time instead of local time
console.log("current time: ", currentTime);
```

### Get LP token supply

```ts
const response = await mainnetConnection.getTokenSupply(vault.state.lpMint);
const result = response.value.amount;
console.log(result);
```

### Get unlocked token amount

```ts
const result = vault.getUnlockedAmount(currentTime);
console.log(result);
```

### Get amount by shares

```ts
const result = vault.getAmountByShare(currentTime, 100_000_000, lpSupply);

console.log(result);
```

### Get un-mint amount

```ts
const result = vault.getUnmintAmount(currentTime, 100_000_000, lpSupply);
console.log(result);
```

<br>

---

<br>

## Interact with Vault

### Getting started

How to get the token info
```ts
import {
  StaticTokenListResolutionStrategy,
  TokenInfo,
} from "@solana/spl-token-registry";

const SOL_TOKEN_INFO = new StaticTokenListResolutionStrategy()
  .resolve()
  .find((token) => token.symbol === "SOL") as TokenInfo;
```

### Deposit SOL

```ts
const result = await vault.deposit(SOL_TOKEN_INFO, 2000);
console.log(result);
```

### Withdraw SOL

```ts
const result = await vault.withdraw(SOL_TOKEN_INFO, 1000);
console.log(result);
```

### Withdraw from Strategy

```ts
const result = await vault.withdrawFromStrategy(SOL_TOKEN_INFO, strategy, 1000);
console.log(result);
```
