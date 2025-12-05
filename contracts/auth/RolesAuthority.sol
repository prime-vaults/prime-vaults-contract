// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {RolesAuthority as SolmateRolesAuthority} from "solmate/src/auth/authorities/RolesAuthority.sol";
import {Authority} from "solmate/src/auth/Auth.sol";

/**
 * @title RolesAuthority
 * @author PrimeVaults
 * @notice Wrapper for Solmate's RolesAuthority contract
 */
contract RolesAuthority is SolmateRolesAuthority {
    constructor(address _auth) SolmateRolesAuthority(msg.sender, Authority(_auth)) {}
}
