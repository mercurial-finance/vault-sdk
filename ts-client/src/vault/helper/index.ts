import BN from 'bn.js';

/**
 *
 * @param share - user's share
 * @param withdrawableAmount - vault's withdrawable amount, vaultImpl.getWithdrawableAmount()
 * @param totalSupply - vault's total lp supply
 * @returns
 */
export function getAmountByShare(share: BN, withdrawableAmount: BN, totalSupply: BN): BN {
  return share.mul(withdrawableAmount).div(totalSupply);
}

/**
 *
 * @param amount - amount of desired underlying token to unstake
 * @param withdrawableAmount - vault's withdrawable amount, vaultImpl.getWithdrawableAmount()
 * @param totalSupply - vault's total lp supply, vaultImpl.lpSupply
 * @returns BN
 */
export function getUnmintAmount(amount: BN, withdrawableAmount: BN, totalSupply: BN) {
  return amount.mul(totalSupply).div(withdrawableAmount);
}
