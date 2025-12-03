// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "solmate/src/tokens/ERC20.sol";

interface IDelayedWithdrawErrors {
    error DelayedWithdraw__WithdrawFeeTooHigh();
    error DelayedWithdraw__AlreadySetup();
    error DelayedWithdraw__WithdrawsNotAllowed();
    error DelayedWithdraw__WithdrawNotMatured();
    error DelayedWithdraw__NoSharesToWithdraw();
    error DelayedWithdraw__BadAddress();
    error DelayedWithdraw__ThirdPartyCompletionNotAllowed();
    error DelayedWithdraw__Paused();
    error DelayedWithdraw__CallerNotBoringVault();
    error DelayedWithdraw__CannotWithdrawBoringToken();
    error DelayedWithdraw__ExpeditedWithdrawFeeTooHigh();
    error DelayedWithdraw__ExpeditedWithdrawNotAvailable();
    error DelayedWithdraw__WithdrawPending();
    error DelayedWithdraw__NoWithdrawToAccelerate();
}
