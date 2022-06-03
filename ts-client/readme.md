# Mercurial Typescript SDK

## Setup

1. install `pnpm` on your machine (https://pnpm.io/installation)
2. install the dependencies by running `pnpm i`
3. run `pnpm test` to run the test


### Usage:
```
import { vault, constants } from 'mercurial-sdk';

const { SOL_MINT, USDC_MINT, USDT_MINT, VAULT_BASE_KEY } = constants

console.log({
    vault, SOL_MINT,
    USDC_MINT,
    USDT_MINT,
    VAULT_BASE_KEY,
})
```