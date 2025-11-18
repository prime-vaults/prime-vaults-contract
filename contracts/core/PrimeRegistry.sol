// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PrimeAuth} from "../auth/PrimeAuth.sol";

/**
 * @title PrimeRegistry
 * @author PrimeVaults Labs
 * @notice Registry contract for tracking Prime Vault deployments
 * @dev Currently a placeholder for future registry functionality
 */
contract PrimeRegistry is PrimeAuth {
    constructor(address _primeRBAC) PrimeAuth(_primeRBAC) {}
}
