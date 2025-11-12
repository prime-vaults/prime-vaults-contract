// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import "hardhat/console.sol";

contract MockStrategist {
    using SafeTransferLib for ERC20;

    constructor() {}

    function deposit(address asset, uint256 amount) external {
        console.log("MockStrategist: deposit called");
        console.log("  asset:", asset);
        console.log("  amount:", amount);
        console.log("  balance:", ERC20(asset).balanceOf(address(this)));
        ERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address asset, uint256 amount, address to) external {
        console.log("MockStrategist: withdraw called");
        console.log("  asset:", asset);
        console.log("  amount:", amount);
        console.log("  to:", to);
        console.log("  balance:", ERC20(asset).balanceOf(address(this)));
        ERC20(asset).safeTransfer(to, amount);
    }
}
