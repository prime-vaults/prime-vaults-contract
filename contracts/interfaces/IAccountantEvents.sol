// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IAccountantEvents {
    event Paused();
    event Unpaused();
    event PlatformFeeUpdated(uint16 oldFee, uint16 newFee);
    event PayoutAddressUpdated(address oldPayout, address newPayout);
    event ExchangeRateUpdated(uint96 oldRate, uint96 newRate, uint64 currentTime);
    event FeesClaimed(address indexed feeAsset, uint256 amount);
}
