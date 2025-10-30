// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface BeforeTransferHook {
    function beforeTransfer(address from, address to, address operator) external view;
}
