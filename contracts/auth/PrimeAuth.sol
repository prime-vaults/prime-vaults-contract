// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Error} from "../helper/Error.sol";
import {IPrimeRegistry} from "../interfaces/IPrimeRegistry.sol";
import {IPrimeRBAC} from "../interfaces/IPrimeRBAC.sol";
import {PrimeRBAC} from "./PrimeRBAC.sol";
import {Auth, Authority} from "solmate/src/auth/Auth.sol";

/**
 * @title PrimeAuth
 * @author PrimeVaults Labs
 * @notice Abstract contract providing authentication functionality integrated with PrimeRegistry
 * @dev Extends Solmate's Auth contract and provides protocol admin role checking via PrimeRBAC
 */
abstract contract PrimeAuth is Auth {
    //============================== STATE ===============================

    /**
     * @notice The PrimeRegistry contract that manages protocol configuration
     */
    IPrimeRegistry public primeRegistry;

    //============================== CONSTRUCTOR ===============================

    /**
     * @notice Initializes the PrimeAuth contract
     * @param _primeRegistry The address of the PrimeRegistry contract
     * @dev Sets the owner to _primeRegistry and validates it's not the zero address
     */
    constructor(address _primeRegistry) Auth(msg.sender, Authority(address(0))) {
        if (_primeRegistry == address(0)) {
            revert Error.ZERO_ADDRESS();
        }
        primeRegistry = IPrimeRegistry(_primeRegistry);
    }

    //============================== MODIFIERS ===============================

    /**
     * @notice Modifier to restrict function access to protocol admins only
     * @dev Checks if msg.sender has the PROTOCOL_ADMIN_ROLE in PrimeRBAC
     */
    modifier onlyProtocolAdmin() {
        if (!IPrimeRBAC(primeRegistry.primeRBAC()).hasProtocolAdminRole(msg.sender)) {
            revert Error.NOT_PROTOCOL_ADMIN();
        }
        _;
    }
}
