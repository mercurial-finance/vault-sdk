# Mercurial Vault SDK

<p align="center">
<img align="center" src="https://vaults.mercurial.finance/icons/logo.svg" width="180" height="180" />
</p>
<br>


### *Major revamp of the SDK has been made. Refer to ~v0.1.0 for the old SDK.

<br>
<hr>
<br>

## Getting started
SDK: https://github.com/mercurial-finance/vault-sdk

Demo: https://vault-sdk-demo.vercel.app/

Demo repo: https://github.com/mercurial-finance/vault-sdk-demo
- Easiest way to get started with our Typescript SDK, the example demo includes all functionality and information we display on our own site.

Docs: https://docs.mercurial.finance/mercurial-dynamic-yield-infra/

Discord: https://discord.com/channels/841152225564950528/864859354335412224

<hr>

## Install (~v0.2)

1. Install deps

```
npm i @mercurial-finance/vault-sdk @project-serum/anchor @solana/web3.js @solana/spl-token @solana/spl-token-registry
```

2. Initialize VaultImpl instance
```ts
import VaultImpl from '@mercurial-finance/vault-sdk';
import { PublicKey } from '@solana/web3.js';
import { StaticTokenListResolutionStrategy, TokenInfo } from "@solana/spl-token-registry";

const tokenMap = new StaticTokenListResolutionStrategy().resolve();
// Find the token info you want to use.
const SOL_TOKEN_INFO = tokenMap.find(token => token.symbol === 'SOL') as TokenInfo;
const vaultImpl = await VaultImpl.create(connection, {
  baseTokenMint: new PublicKey(SOL_TOKEN_INFO.address),
  baseTokenDecimals: SOL_TOKEN_INFO.decimals,
});
```

3. To interact with the VaultImpl
```ts
const mockWallet = new Wallet(new Keypair());

// Get the user's ATA LP balance
const userBalance = await vaultImpl.getUserBalance();

// To refetch the vault's latest supply
// Alternatively, use `vaultImpl.lpSupply`
const lpSupply = await vaultImpl.getVaultSupply();

// Rewards are not instantly redeemable, and are subject to a lock.
// This function returns the amount of LP that are redeemable.
const unlockedAmount = await getWithdrawableAmount()

// To deposit into the vault
const amountInLamports = 1 * 10 ** SOL_TOKEN_INFO.decimals; // 1.0 SOL
const depositTx = await vaultImpl.deposit(mockWallet.publicKey, amountInLamports); // Web3 Transaction Object
const depositResult = await provider.sendAndConfirm(depositTx); // Transaction hash

// To withdraw from the vault
const amountInLamports = 1 * 10 ** SOL_TOKEN_INFO.decimals; // 1.0 SOL
const withdrawTx = await vaultImpl.withdraw(mockWallet.publicKey, amountInLamports); // Web3 Transaction Object
const withdrawResult = await provider.sendAndConfirm(withdrawTx); // Transaction hash
```

<br>
<br>
<hr />
<br>
<br>

 ## Install (~v0.1.0)

1. Install deps

```
npm i @mercurial-finance/vault-sdk @project-serum/anchor @solana/web3.js
```

2. Setup the required parameters, and init the instance

```ts
import Vault from '@mercurial-finance/vault-sdk';
import { Connection, Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY, ParsedAccountData } from '@solana/web3.js';
import { Wallet, AnchorProvider } from '@project-serum/anchor';

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function main() {
  const mockWallet = new Wallet(new Keypair()); // Or real wallet private key
  const mainnetConnection = new Connection('https://api.mainnet-beta.solana.com');
  const provider = new AnchorProvider(mainnetConnection, mockWallet, {
    commitment: 'processed',
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
import { SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';

const parsedClock = await mainnetConnection.getParsedAccountInfo(SYSVAR_CLOCK_PUBKEY);

const parsedClockAccount = (parsedClock.value!.data as ParsedAccountData).parsed as ParsedClockState;

const currentTime = parsedClockAccount.info.unixTimestamp; // use on-chain time instead of local time
console.log('current time: ', currentTime);
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
import { StaticTokenListResolutionStrategy, TokenInfo } from '@solana/spl-token-registry';

const SOL_TOKEN_INFO = new StaticTokenListResolutionStrategy()
  .resolve()
  .find((token) => token.symbol === 'SOL') as TokenInfo;
```

### Deposit

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
