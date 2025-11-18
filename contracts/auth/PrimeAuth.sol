// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Error} from "../helper/Error.sol";
import {IPrimeRBAC} from "../interfaces/IPrimeRBAC.sol";
import {PrimeRBAC} from "./PrimeRBAC.sol";
import {Auth, Authority} from "solmate/src/auth/Auth.sol";

/**
 * @title PrimeAuth
 * @author PrimeVaults Labs
 * @notice Abstract contract providing authentication functionality integrated with PrimeRBAC
 * @dev Extends Solmate's Auth contract and provides protocol admin role checking via PrimeRBAC
 */
abstract contract PrimeAuth is Auth {
    //============================== STATE ===============================

    /**
     * @notice The PrimeRBAC contract that manages role-based access control
     */
    IPrimeRBAC public primeRBAC;

    //============================== CONSTRUCTOR ===============================

    /**
     * @notice Initializes the PrimeAuth contract
     * @param _primeRBAC The address of the PrimeRBAC contract
     * @dev Sets the owner to msg.sender and validates primeRBAC is not the zero address
     */
    constructor(address _primeRBAC) Auth(msg.sender, Authority(address(0))) {
        if (_primeRBAC == address(0)) {
            revert Error.ZERO_ADDRESS();
        }
        primeRBAC = IPrimeRBAC(_primeRBAC);
    }

    //============================== MODIFIERS ===============================

    /**
     * @notice Modifier to restrict function access to protocol admins only
     * @dev Checks if msg.sender has the PROTOCOL_ADMIN_ROLE in PrimeRBAC
     */
    modifier onlyProtocolAdmin() {
        if (!primeRBAC.hasProtocolAdminRole(msg.sender)) {
            revert Error.NOT_PROTOCOL_ADMIN();
        }
        _;
    }

    modifier onlyEmergencyAdmin() {
        if (!primeRBAC.hasEmergencyAdminRole(msg.sender)) {
            revert Error.NOT_EMERGENCY_ADMIN();
        }
        _;
    }
}
