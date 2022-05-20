import * as anchor from "@project-serum/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import Vault from "../src/vault";
import { SOL_MINT } from "../src/constants";

const mockWallet = new anchor.Wallet(Keypair.generate());
const mockConnection = new Connection("https://api.mainnet-beta.solana.com");

test("Vault State", async () => {
  const vault = new Vault(mockWallet, mockConnection);
  await vault.getVaultStateByMint(SOL_MINT);

  const lpSupply = (await mockConnection.getTokenSupply(vault.state.lpMint))
    .value.amount;
  console.log("total lp supply: ", lpSupply);

  const currentTime = Math.floor(Date.now() / 1000);
  const unlockedAmount = vault.getUnlockedAmount(currentTime);
  console.log("total unlocked amount: ", unlockedAmount);

  const amountByShare = vault.getAmountByShare(
    currentTime,
    100_000_000,
    lpSupply
  );
  console.log("amount by share: ", amountByShare);

  const unmintAmount = vault.getUnmintAmount(
    currentTime,
    100_000_000,
    lpSupply
  );
  console.log("unmint amount: ", unmintAmount);
});
