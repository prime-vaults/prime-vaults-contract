// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Error} from "../helper/Error.sol";
import {IPrimeRBAC} from "../interfaces/IPrimeRBAC.sol";
import {PrimeRBAC} from "./PrimeRBAC.sol";
import {Auth, Authority} from "solmate/src/auth/Auth.sol";
import {IPausable} from "../interfaces/IPausable.sol";
import {IPausableEvents} from "../interfaces/IPausableEvents.sol";

/**
 * @title PrimeAuth
 * @author PrimeVaults Labs
 * @notice Abstract contract providing authentication functionality integrated with PrimeRBAC
 * @dev Extends Solmate's Auth contract and provides protocol admin role checking via PrimeRBAC
 */
abstract contract PrimeAuth is Auth, IPausable, IPausableEvents {
    /* ========================================= STATE ========================================= */

    /** @notice PrimeRBAC contract for protocol-level role management */
    IPrimeRBAC public primeRBAC;

    /** @notice Pause status for contract operations */
    bool public isPaused;

    /* ========================================= CONSTRUCTOR ========================================= */

    /**
     * @notice Initialize PrimeAuth with RBAC integration
     * @param _primeRBAC PrimeRBAC contract address
     * @param _authority RolesAuthority contract address
     */
    constructor(address _primeRBAC, address _authority) Auth(msg.sender, Authority(_authority)) {
        if (_primeRBAC == address(0) || _authority == address(0)) {
            revert Error.ZERO_ADDRESS();
        }
        primeRBAC = IPrimeRBAC(_primeRBAC);
    }

    /* ========================================= MODIFIERS ========================================= */

    /**
     * @notice Restrict access to protocol admins
     * @dev Checks PROTOCOL_ADMIN_ROLE in PrimeRBAC
     */
    modifier onlyProtocolAdmin() {
        if (!primeRBAC.hasProtocolAdminRole(msg.sender)) {
            revert Error.NOT_PROTOCOL_ADMIN();
        }
        _;
    }

    /**
     * @notice Restrict access to emergency admins
     * @dev Checks EMERGENCY_ADMIN_ROLE in PrimeRBAC
     */
    modifier onlyEmergencyAdmin() {
        if (!primeRBAC.hasEmergencyAdminRole(msg.sender)) {
            revert Error.NOT_EMERGENCY_ADMIN();
        }
        _;
    }

    /**
     * @notice Restrict access to operators
     * @dev Checks OPERATOR_ROLE in PrimeRBAC
     */
    modifier onlyOperator() {
        if (!primeRBAC.hasOperatorRole(msg.sender)) {
            revert Error.NOT_OPERATOR();
        }
        _;
    }

    /* ========================================= PAUSE FUNCTIONS ========================================= */

    /**
     * @notice Pause contract operations
     * @dev Restricted to EMERGENCY_ADMIN_ROLE
     */
    function pause() external onlyEmergencyAdmin {
        isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause contract operations
     * @dev Restricted to EMERGENCY_ADMIN_ROLE
     */
    function unpause() external onlyEmergencyAdmin {
        isPaused = false;
        emit Unpaused();
    }
}
