// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PrimeAuth} from "../auth/PrimeAuth.sol";
import {RolesAuthority} from "solmate/src/auth/authorities/RolesAuthority.sol";
import {Authority} from "solmate/src/auth/Auth.sol";
import {BoringVault} from "./BoringVault.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

import "hardhat/console.sol";

/**
 * @title PrimeRegistry
 * @author PrimeVaults Labs
 * @notice Registry contract for tracking and deploying Prime Vault instances
 * @dev Factory contract that creates new vaults with standardized naming
 */
contract PrimeRegistry is PrimeAuth {
    //============================== CONSTANTS ===============================
    uint8 public constant ADMIN_ROLE = 1;
    uint8 public constant MANAGER_ROLE = 2;
    uint8 public constant MINTER_ROLE = 3;
    uint8 public constant BORING_VAULT_ROLE = 4;
    uint8 public constant STRATEGIST_ROLE = 7;
    uint8 public constant BURNER_ROLE = 8;
    uint8 public constant SOLVER_ROLE = 9;
    uint8 public constant QUEUE_ROLE = 10;
    uint8 public constant CAN_SOLVE_ROLE = 11;

    //============================== EVENTS ===============================

    event VaultCreated(address indexed vault, address indexed asset, address indexed rolesAuthority);

    //============================== ERRORS ===============================

    error PrimeRegistry__ZeroAddress();
    error PrimeRegistry__InvalidAuthority();

    //============================== CONSTRUCTOR ===============================

    constructor(address _primeRBAC) PrimeAuth(_primeRBAC, address(0)) {}

    //============================== ADMIN FUNCTIONS ===============================

    /**
     * @notice Register and setup permissions for a vault
     * @param vault The BoringVault to register
     */
    function registerVault(BoringVault vault) public onlyProtocolAdmin {
        Authority authority = vault.authority();
        RolesAuthority rolesAuthority = RolesAuthority(address(authority));

        // Set role capabilities for vault management
        rolesAuthority.setRoleCapability(MANAGER_ROLE, address(vault), BoringVault.manage.selector, true);
        rolesAuthority.setRoleCapability(MANAGER_ROLE, address(vault), BoringVault.bulkManage.selector, true);

        // Set role capabilities for minting and burning shares
        rolesAuthority.setRoleCapability(MINTER_ROLE, address(vault), BoringVault.enter.selector, true);
        rolesAuthority.setRoleCapability(BURNER_ROLE, address(vault), BoringVault.exit.selector, true);

        rolesAuthority.transferOwnership(msg.sender);
        emit VaultCreated(address(vault), address(vault.asset()), address(rolesAuthority));
    }
}
