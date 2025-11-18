// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IBeforeTransferHook {
    function beforeTransfer(address from, address to, address operator) external view;
}
