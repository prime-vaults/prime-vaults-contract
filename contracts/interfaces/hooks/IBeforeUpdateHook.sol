// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IBeforeUpdateHook {
    function beforeUpdate(address from, address to, uint256 amount) external;
}
