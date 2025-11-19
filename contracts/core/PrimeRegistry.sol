// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PrimeAuth} from "../auth/PrimeAuth.sol";
import {RolesAuthority} from "solmate/src/auth/authorities/RolesAuthority.sol";
import {Authority} from "solmate/src/auth/Auth.sol";
import {BoringVault} from "./BoringVault.sol";
import {AccountantWithYieldStreaming} from "./AccountantWithYieldStreaming.sol";
import {TellerWithYieldStreaming} from "./TellerWithYieldStreaming.sol";
import {ManagerWithMerkleVerification} from "./ManagerWithMerkleVerification.sol";
import {DelayedWithdraw} from "./DelayedWithdraw.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

import "hardhat/console.sol";

/**
 * @title PrimeRegistry
 * @author PrimeVaults Labs
 * @notice Registry contract for tracking and deploying Prime Vault instances
 * @dev Factory contract that creates new vaults with standardized naming
 */
contract PrimeRegistry is PrimeAuth {
    //============================== STRUCTS ===============================

    struct VaultComponents {
        address accountant;
        address teller;
        address manager;
        address withdrawer;
        address rolesAuthority;
    }

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

    //============================== STATE ===============================

    /**
     * @notice Mapping of vault address to its components
     */
    mapping(address => VaultComponents) public vaults;

    //============================== EVENTS ===============================

    event VaultCreated(address indexed vault, address indexed asset, address indexed rolesAuthority);
    event AccountantRegistered(address indexed accountant, address indexed vault);
    event TellerRegistered(address indexed teller, address indexed vault);
    event ManagerRegistered(address indexed manager, address indexed vault);
    event WithdrawerRegistered(address indexed withdrawer, address indexed vault);

    //============================== ERRORS ===============================

    error PrimeRegistry__ZeroAddress();
    error PrimeRegistry__InvalidAuthority();
    error PrimeRegistry__AccountantNotRegistered();
    error PrimeRegistry__TellerNotRegistered();
    error PrimeRegistry__WithdrawerNotRegistered();

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

        rolesAuthority.setUserRole(address(vault), BORING_VAULT_ROLE, true);

        vaults[address(vault)].rolesAuthority = address(rolesAuthority);
        emit VaultCreated(address(vault), address(vault.asset()), address(rolesAuthority));
    }

    /**
     * @notice Register and setup permissions for an accountant
     * @param accountant The AccountantWithYieldStreaming to register
     */
    function registerAccountant(AccountantWithYieldStreaming accountant) public onlyProtocolAdmin {
        Authority authority = accountant.authority();
        RolesAuthority rolesAuthority = RolesAuthority(address(authority));

        // Set role capabilities for Accountant functions
        rolesAuthority.setRoleCapability(
            MINTER_ROLE,
            address(accountant),
            accountant.setFirstDepositTimestamp.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            STRATEGIST_ROLE,
            address(accountant),
            bytes4(keccak256("updateExchangeRate()")),
            true
        );

        rolesAuthority.setUserRole(address(accountant), MINTER_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), ADMIN_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), STRATEGIST_ROLE, true);

        vaults[address(accountant.vault())].accountant = address(accountant);
        emit AccountantRegistered(address(accountant), address(accountant.vault()));
    }

    /**
     * @notice Register and setup permissions for a teller
     * @param teller The TellerWithYieldStreaming to register
     */
    function registerTeller(TellerWithYieldStreaming teller) public onlyProtocolAdmin {
        Authority authority = teller.authority();
        RolesAuthority rolesAuthority = RolesAuthority(address(authority));

        // Set public capability for deposit
        rolesAuthority.setPublicCapability(address(teller), teller.deposit.selector, true);

        // Set role capabilities for Teller functions
        rolesAuthority.setRoleCapability(MINTER_ROLE, address(teller), teller.depositWithPermit.selector, true);
        rolesAuthority.setRoleCapability(BURNER_ROLE, address(teller), teller.withdraw.selector, true);

        // Set role capabilities for buffer helper management
        rolesAuthority.setRoleCapability(MANAGER_ROLE, address(teller), teller.setDepositBufferHelper.selector, true);
        rolesAuthority.setRoleCapability(MANAGER_ROLE, address(teller), teller.setWithdrawBufferHelper.selector, true);
        rolesAuthority.setRoleCapability(MANAGER_ROLE, address(teller), teller.allowBufferHelper.selector, true);

        rolesAuthority.setUserRole(address(teller), MINTER_ROLE, true);
        rolesAuthority.setUserRole(address(teller), BURNER_ROLE, true);
        rolesAuthority.setUserRole(address(teller), MANAGER_ROLE, true);
        rolesAuthority.setUserRole(address(teller), STRATEGIST_ROLE, true);

        vaults[address(teller.vault())].teller = address(teller);
        emit TellerRegistered(address(teller), address(teller.vault()));
    }

    /**
     * @notice Register and setup permissions for a manager
     * @param manager The ManagerWithMerkleVerification to register
     */
    function registerManager(ManagerWithMerkleVerification manager) public onlyProtocolAdmin {
        Authority authority = manager.authority();
        RolesAuthority rolesAuthority = RolesAuthority(address(authority));

        // Set role capability for manageVaultWithMerkleVerification
        rolesAuthority.setRoleCapability(
            STRATEGIST_ROLE,
            address(manager),
            bytes4(keccak256("manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[]")),
            true
        );

        // Grant MANAGER_ROLE to manager contract (so it can call vault.manage())
        rolesAuthority.setUserRole(address(manager), MANAGER_ROLE, true);

        vaults[address(manager.vault())].manager = address(manager);
        emit ManagerRegistered(address(manager), address(manager.vault()));
    }

    /**
     * @notice Register and setup permissions for a withdrawer
     * @param withdrawer The DelayedWithdraw to register
     */
    function registerWithdrawer(DelayedWithdraw withdrawer) public onlyProtocolAdmin {
        Authority authority = withdrawer.authority();
        RolesAuthority rolesAuthority = RolesAuthority(address(authority));

        // Set public capabilities for withdrawer user functions
        rolesAuthority.setPublicCapability(address(withdrawer), withdrawer.cancelWithdraw.selector, true);
        rolesAuthority.setPublicCapability(address(withdrawer), withdrawer.requestWithdraw.selector, true);
        rolesAuthority.setPublicCapability(address(withdrawer), withdrawer.completeWithdraw.selector, true);
        rolesAuthority.setPublicCapability(address(withdrawer), withdrawer.setAllowThirdPartyToComplete.selector, true);

        rolesAuthority.setUserRole(address(withdrawer), BURNER_ROLE, true);

        vaults[address(withdrawer.boringVault())].withdrawer = address(withdrawer);
        emit WithdrawerRegistered(address(withdrawer), address(withdrawer.boringVault()));
    }
}
