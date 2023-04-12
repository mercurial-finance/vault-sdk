import BN from 'bn.js';
import { LOCKED_PROFIT_DEGRADATION_DENOMINATOR } from '../constants';
import { VaultState } from '../types';

/**
 *
 * @param share - user's share
 * @param withdrawableAmount - vault's withdrawable amount, vaultImpl.getWithdrawableAmount()
 * @param totalSupply - vault's total lp supply
 * @returns
 */
export function getAmountByShare(share: BN, withdrawableAmount: BN, totalSupply: BN): BN {
  return totalSupply.isZero() ? new BN(0) : share.mul(withdrawableAmount).div(totalSupply);
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

/**
 * `calculateWithdrawableAmount` calculates the amount of funds that can be withdrawn from a vault with vault state provided
 * @param {number} onChainTime - the current time on the blockchain
 * @param {VaultState} vaultState - VaultState
 * @returns The amount of the vault that can be withdrawn.
 */
export function calculateWithdrawableAmount(onChainTime: number, vaultState: VaultState) {
  const {
    lockedProfitTracker: { lastReport, lockedProfitDegradation, lastUpdatedLockedProfit },
    totalAmount: vaultTotalAmount,
  } = vaultState;

  const duration = new BN(onChainTime).sub(lastReport);

  const lockedFundRatio = duration.mul(lockedProfitDegradation);
  if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
    return vaultTotalAmount;
  }

  const lockedProfit = lastUpdatedLockedProfit
    .mul(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.sub(lockedFundRatio))
    .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR);

  return vaultTotalAmount.sub(lockedProfit);
}
