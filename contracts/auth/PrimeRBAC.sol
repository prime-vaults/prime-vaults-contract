// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

contract PrimeRBAC is AccessControlEnumerable {
    /// @dev used in many areas of the codebase to perform config operations
    /// @notice at least one address must be assigned this role
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");

    /// @dev used in a few areas of the code
    /// @notice at least one address must be assigned this role
    bytes32 public constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");

    /// @dev used to perform routine operations
    /// @notice at least one address must be assigned this role
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _grantRole(PROTOCOL_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _setRoleAdmin(PROTOCOL_ADMIN_ROLE, PROTOCOL_ADMIN_ROLE);
        _setRoleAdmin(EMERGENCY_ADMIN_ROLE, PROTOCOL_ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, PROTOCOL_ADMIN_ROLE);
    }

    //////////////////////////////////////////////////////////////
    //              EXTERNAL VIEW FUNCTIONS                     //
    //////////////////////////////////////////////////////////////

    function hasProtocolAdminRole(address admin_) external view returns (bool) {
        return hasRole(PROTOCOL_ADMIN_ROLE, admin_);
    }

    function grantProtocolAdminRole(address admin_) external {
        grantRole(PROTOCOL_ADMIN_ROLE, admin_);
    }

    function hasEmergencyAdminRole(address emergencyAdmin_) external view returns (bool) {
        return hasRole(EMERGENCY_ADMIN_ROLE, emergencyAdmin_);
    }

    function grantEmergencyAdminRole(address emergencyAdmin_) external {
        grantRole(EMERGENCY_ADMIN_ROLE, emergencyAdmin_);
    }

    function hasOperatorRole(address operator_) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, operator_);
    }

    function grantOperatorRole(address operator_) external {
        grantRole(OPERATOR_ROLE, operator_);
    }
}
