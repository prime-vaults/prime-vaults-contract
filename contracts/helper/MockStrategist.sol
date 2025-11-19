// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";

contract MockStrategist {
    using SafeTransferLib for ERC20;

    constructor() {}

    function deposit(address asset, uint256 amount) external {
        ERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address asset, uint256 amount, address to) external {
        ERC20(asset).safeTransfer(to, amount);
    }
}
