// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

contract PrimeRBAC is AccessControlEnumerable {
    /// @dev highest level role for ownership operations
    /// @notice only one address should have this role
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    /// @dev used in many areas of the codebase to perform config operations
    /// @notice at least one address must be assigned this role
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");

    /// @dev used to perform routine operations
    /// @notice at least one address must be assigned this role
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(PROTOCOL_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
        _setRoleAdmin(PROTOCOL_ADMIN_ROLE, OWNER_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, OWNER_ROLE);
    }

    //////////////////////////////////////////////////////////////
    //              EXTERNAL VIEW FUNCTIONS                     //
    //////////////////////////////////////////////////////////////

    function hasOwnerRole(address owner_) external view returns (bool) {
        return hasRole(OWNER_ROLE, owner_);
    }

    function grantOwnerRole(address owner_) external {
        grantRole(OWNER_ROLE, owner_);
    }

    function hasProtocolAdminRole(address admin_) external view returns (bool) {
        return hasRole(PROTOCOL_ADMIN_ROLE, admin_);
    }

    function grantProtocolAdminRole(address admin_) external {
        grantRole(PROTOCOL_ADMIN_ROLE, admin_);
    }

    function hasOperatorRole(address operator_) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, operator_);
    }

    function grantOperatorRole(address operator_) external {
        grantRole(OPERATOR_ROLE, operator_);
    }
}
