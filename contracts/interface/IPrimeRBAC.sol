// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.30;

import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";

/// @title IPrimeRBAC
/// @dev Interface for PrimeRBAC
/// @author Prime Labs.
interface IPrimeRBAC is IAccessControl {
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

    /// @dev returns the id of the emergency admin role
    function EMERGENCY_ADMIN_ROLE() external view returns (bytes32);

    /// @dev returns the id of the protocol minter role
    function MINTER_ROLE() external view returns (bytes32);

    /// @dev returns the id of the protocol burner role
    function BURNER_ROLE() external view returns (bytes32);

    /// @dev returns whether the given address has the protocol admin role
    /// @param admin_ the address to check
    function hasProtocolAdminRole(address admin_) external view returns (bool);

    /// @dev returns whether the given address has the emergency admin role
    /// @param admin_ the address to check
    function hasEmergencyAdminRole(address admin_) external view returns (bool);
}
