// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IPrimeRBAC
/// @dev Interface for PrimeRBAC
/// @author Prime Labs.
interface IPrimeRBAC {
    //////////////////////////////////////////////////////////////
    //                           STRUCTS                         //
    //////////////////////////////////////////////////////////////

    struct InitialRoleSetup {
        address admin;
        address emergencyAdmin;
    }

    //////////////////////////////////////////////////////////////
    //              EXTERNAL VIEW FUNCTIONS                     //
    //////////////////////////////////////////////////////////////

    /// @dev returns the id of the protocol admin role
    function PROTOCOL_ADMIN_ROLE() external view returns (bytes32);

    /// @dev returns the id of the operator role
    function OPERATOR_ROLE() external view returns (bytes32);

    /// @dev returns whether the given address has the protocol admin role
    /// @param admin_ the address to check
    function hasProtocolAdminRole(address admin_) external view returns (bool);

    /// @dev returns whether the given address has the emergency admin role
    /// @param admin_ the address to check
    function hasEmergencyAdminRole(address admin_) external view returns (bool);

    /// @dev returns whether the given address has the operator role
    /// @param operator_ the address to check
    function hasOperatorRole(address operator_) external view returns (bool);
}
