// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "solmate/src/tokens/ERC20.sol";

interface IDelayedWithdraw {
    /* ========================================= ERRORS ========================================= */
    error DelayedWithdraw__WithdrawsNotAllowed();
    error DelayedWithdraw__BadAddress();
    error DelayedWithdraw__NoSharesToWithdraw();
    error DelayedWithdraw__WithdrawNotMatured();
    error DelayedWithdraw__MaxLossExceeded();
    error DelayedWithdraw__AlreadySetup();
    error DelayedWithdraw__WithdrawFeeTooHigh();
    error DelayedWithdraw__ThirdPartyCompletionNotAllowed();
    error DelayedWithdraw__Paused();
    error DelayedWithdraw__CannotWithdrawBoringToken();
    error DelayedWithdraw__ExpeditedWithdrawFeeTooHigh();
    error DelayedWithdraw__WithdrawAlreadyAccelerated();
    error DelayedWithdraw__CallerNotBoringVault();
    error DelayedWithdraw__ExpeditedWithdrawNotAvailable();
    error DelayedWithdraw__WithdrawPending();
    error DelayedWithdraw__NoWithdrawToAccelerate();

    /* ========================================= EVENTS ========================================= */
    event WithdrawRequested(address indexed account, ERC20 indexed asset, uint96 shares, uint40 maturity);
    event WithdrawCancelled(address indexed account, ERC20 indexed asset, uint96 shares);
    event WithdrawCompleted(address indexed account, ERC20 indexed asset, uint256 shares, uint256 assets);
    event FeeAddressSet(address newFeeAddress);
    event SetupWithdrawalsInAsset(address indexed asset, uint64 withdrawDelay, uint16 withdrawFee);
    event WithdrawDelayUpdated(address indexed asset, uint32 newWithdrawDelay);
    event WithdrawFeeUpdated(address indexed asset, uint16 newWithdrawFee);
    event WithdrawalsStopped(address indexed asset);
    event ThirdPartyCompletionChanged(address indexed account, ERC20 indexed asset, bool allowed);
    event PullFundsFromVaultUpdated(bool _pullFundsFromVault);
    event ExpeditedWithdrawFeeUpdated(uint16 newFee);
    event WithdrawAccelerated(address indexed account, ERC20 indexed asset, uint40 newMaturity, uint96 accelerationFee);
}
