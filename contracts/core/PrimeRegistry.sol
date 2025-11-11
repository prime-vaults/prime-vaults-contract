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
    address public primeRBAC;

    constructor(address _primeRBAC) Ownable(msg.sender) {
        if (_primeRBAC == address(0)) {
            revert Error.ZERO_ADDRESS();
        }
        primeRBAC = _primeRBAC;
    }
}
