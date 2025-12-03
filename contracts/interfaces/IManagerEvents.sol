// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IManagerEvents {
    event ManageRootUpdated(address indexed strategist, bytes32 oldRoot, bytes32 newRoot);
    event BoringVaultManaged(uint256 callsMade);
    event Paused();
    event Unpaused();
}
