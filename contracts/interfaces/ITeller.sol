// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ITeller {
    /* ========================================= ERRORS ========================================= */
    error Teller__ShareLockPeriodTooLong();
    error Teller__SharesAreLocked();
    error Teller__ZeroAssets();
    error Teller__MinimumMintNotMet();
    error Teller__MinimumAssetsNotMet();
    error Teller__PermitFailedAndAllowanceTooLow();
    error Teller__ZeroShares();
    error Teller__MinimumSharesNotMet();
    error Teller__Paused();
    error Teller__DepositsNotAllowed();
    error Teller__WithdrawsNotAllowed();
    error Teller__TransferDenied(address from, address to, address operator);
    error Teller__SharesAreUnLocked(address account);
    error Teller__NotApprovedToTransfer();
    error Teller__DepositCapReached();
    error Teller__DualDeposit();
    error Teller__DepositExceedsCap(uint256 attemptedDeposit, uint256 depositCap);

    /* ========================================= EVENTS ========================================= */
    event DepositsAllowed(bool allowed);
    event WithdrawsAllowed(bool allowed);
    event Deposit(
        uint256 nonce,
        address indexed receiver,
        uint256 depositAmount,
        uint256 shareAmount,
        uint256 depositTimestamp,
        uint256 shareLockPeriodAtTimeOfDeposit
    );
    event BulkDeposit(address indexed asset, uint256 depositAmount);
    event Withdraw(address indexed asset, uint256 shareAmount);
    event DenyFrom(address indexed user);
    event DenyTo(address indexed user);
    event DenyOperator(address indexed user);
    event AllowFrom(address indexed user);
    event AllowTo(address indexed user);
    event AllowOperator(address indexed user);
    event PermissionedTransfersSet(bool permissionedTransfers);
    event AllowPermissionedOperator(address indexed operator);
    event DenyPermissionedOperator(address indexed operator);
    event DepositCapSet(uint112 cap);
    event CompoundReward(address indexed account, uint256 amount, uint256 shares);
}
