// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPausableEvents} from "./IPausableEvents.sol";

interface IManagerEvents is IPausableEvents {
    event ManageRootUpdated(address indexed strategist, bytes32 oldRoot, bytes32 newRoot);
    event BoringVaultManaged(uint256 callsMade);
}
