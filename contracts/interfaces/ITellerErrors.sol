// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ITellerErrors {
    error Teller__ShareLockPeriodTooLong();
    error Teller__SharesAreLocked();
    error Teller__ZeroAssets();
    error Teller__MinimumMintNotMet();
    error Teller__MinimumAssetsNotMet();
    error Teller__PermitFailedAndAllowanceTooLow();
    error Teller__ZeroShares();
    error Teller__DualDeposit();
    error Teller__Paused();
    error Teller__TransferDenied(address from, address to, address operator);
    error Teller__DepositExceedsCap(uint256 attemptedDeposit, uint256 depositCap);
    error Teller__DepositsNotAllowed();
    error Teller__WithdrawsNotAllowed();
}
