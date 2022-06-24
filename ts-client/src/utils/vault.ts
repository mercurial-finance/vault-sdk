import { PublicKey } from "@solana/web3.js";
import { SEEDS, VAULT_BASE_KEY } from "../constants/vault";

export const getVaultPdas = async (
  tokenMint: PublicKey,
  programId: PublicKey
) => {
  const [vault, _vaultBump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(SEEDS.VAULT_PREFIX),
      tokenMint.toBuffer(),
      VAULT_BASE_KEY.toBuffer(),
    ],
    programId
  );

  const [tokenVault, lpMint] = await Promise.all([
    PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.TOKEN_VAULT_PREFIX), vault.toBuffer()],
      programId
    ),
    PublicKey.findProgramAddress(
      [Buffer.from(SEEDS.LP_MINT_PREFIX), vault.toBuffer()],
      programId
    ),
  ]);

  return {
    vaultPda: vault,
    tokenVaultPda: tokenVault[0],
    lpMintPda: lpMint[0],
  };
};
