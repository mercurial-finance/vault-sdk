# Mercurial Vault SDK

<p align="center">
<img align="center" src="https://vaults.mercurial.finance/icons/logo.svg" width="180" height="180" />
</p>
<br>

## Getting started
NPM: https://www.npmjs.com/package/@mercurial-finance/vault-sdk

SDK: https://github.com/mercurial-finance/vault-sdk

Demo: https://vault-sdk-demo.vercel.app/

Demo repo: https://github.com/mercurial-finance/vault-sdk-demo
- Easiest way to get started with our Typescript SDK, the example demo includes all functionality and information we display on our own site.

Docs: https://docs.mercurial.finance/mercurial-dynamic-yield-infra/

Discord: https://discord.com/channels/841152225564950528/864859354335412224

<hr>

## Install

1. Install deps

```
npm i @mercurial-finance/vault-sdk @project-serum/anchor @solana/web3.js @solana/spl-token @solana/spl-token-registry
```

2. Initialize VaultImpl instance
- Affiliate or partner? refer to the [Vault Affiliate Program]()
```ts
import VaultImpl from '@mercurial-finance/vault-sdk';
import { PublicKey } from '@solana/web3.js';
import { StaticTokenListResolutionStrategy, TokenInfo } from "@solana/spl-token-registry";
import { Wallet, AnchorProvider } from '@project-serum/anchor';

// Connection, Wallet, and AnchorProvider to interact with the network
const mainnetConnection = new Connection('https://api.mainnet-beta.solana.com');
const mockWallet = new Wallet(new Keypair());
const provider = new AnchorProvider(mainnetConnection, mockWallet, {
    commitment: 'confirmed',
});
// Alternatively, to use Solana Wallet Adapter, refer to `Demo Repo`

const tokenMap = new StaticTokenListResolutionStrategy().resolve();
// Find the token info you want to use.
const SOL_TOKEN_INFO = tokenMap.find(token => token.symbol === 'SOL') as TokenInfo;
const vaultImpl = await VaultImpl.create(connection, SOL_TOKEN_INFO);
```

3. To interact with the VaultImpl
```ts
// To refetch the vault's latest supply
// Alternatively, use `vaultImpl.lpSupply`
const lpSupply = await vaultImpl.getVaultSupply();

// Rewards are not instantly redeemable, and are subject to a lock.
// This function returns the amount of LP that are redeemable.
const unlockedAmount = await vaultImpl.getWithdrawableAmount()

// To deposit into the vault
const amountInLamports = 1 * 10 ** SOL_TOKEN_INFO.decimals; // 1.0 SOL
const depositTx = await vaultImpl.deposit(mockWallet.publicKey, new BN(amountInLamports)); // Web3 Transaction Object
const depositResult = await provider.sendAndConfirm(depositTx); // Transaction hash

// Get the user's ATA LP balance
const userLpBalance = await vaultImpl.getUserBalance(mockWallet.publicKey);

// To withdraw from the vault
const withdrawTx = await vaultImpl.withdraw(mockWallet.publicKey, new BN(userLpBalance)); // Web3 Transaction Object
const withdrawResult = await provider.sendAndConfirm(withdrawTx); // Transaction hash
```

4. Helper function
```ts
import { helper } from '@mercurial-finance/vault-sdk';

const userShare = await vaultImpl.getUserBalance(mockWallet.publicKey);
const unlockedAmount = await vaultImpl.getWithdrawableAmount()
const lpSupply = await vaultImpl.getVaultSupply();

// To convert user's LP balance into underlying token amount
const underlyingShare = helper.getAmountByShare(userShare, unlockedAmount, lpSupply)

// To convert underlying token amount into user's LP balance
const amountInLamports = 1 * 10 ** SOL_TOKEN_INFO.decimals; // 1.0 SOL
const lpToUnmint = helper.getUnmintAmount(new BN(amountInLamports), unlockedAmount, lpSupply) // To withdraw 1.0 SOL
```

<hr>

## Vault Affiliate
To be a part of the Mercurial Finance's Vault Affiliate Program, visit our Discord above!

<br>

#### To initialize vault with affiliate
Affiliates only need to initialize the vault instance with the third paratemer `opt.affiliate`, subsequently, all interaction with the vault are the same as the usage guide above, no further configuration required.

```ts
const vaultImpl = await VaultImpl.create(
    connection, 
    SOL_TOKEN_INFO,
    {
        affiliateId: new PublicKey('YOUR_PARTNER_PUBLIC_KEY');
    }
);
```

#### To check Partner info
```ts
// Affiliate / Partner info
const partnerInfo = await vaultImpl.getAffiliateInfo();
```