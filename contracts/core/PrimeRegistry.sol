// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {RolesAuthority, Authority} from "solmate/src/auth/authorities/RolesAuthority.sol";
import {Error} from "../helper/Error.sol";
import {PrimeRBAC} from "../auth/PrimeRBAC.sol";

import "./BoringVault.sol";
import "./AccountantWithYieldStreaming.sol";
import "./AccountantWithRateProviders.sol";
import "./TellerWithMultiAssetSupport.sol";
import "./TellerWithBuffer.sol";
import "./TellerWithYieldStreaming.sol";
import "./DelayedWithdraw.sol";

import "./PrimeBufferHelper.sol";

contract PrimeRegistry is Ownable {
    uint8 public constant ADMIN_ROLE = 1;
    uint8 public constant MANAGER_ROLE = 2;
    uint8 public constant MINTER_ROLE = 3;
    uint8 public constant BORING_VAULT_ROLE = 4;
    uint8 public constant UPDATE_EXCHANGE_RATE_ROLE = 3;
    uint8 public constant STRATEGIST_ROLE = 7;
    uint8 public constant BURNER_ROLE = 8;
    uint8 public constant SOLVER_ROLE = 9;
    uint8 public constant QUEUE_ROLE = 10;
    uint8 public constant CAN_SOLVE_ROLE = 11;

    address public primeRBAC;

    constructor(address _primeRBAC) Ownable(msg.sender) {
        if (_primeRBAC == address(0)) {
            revert Error.ZERO_ADDRESS();
        }
        primeRBAC = _primeRBAC;
    }
}
