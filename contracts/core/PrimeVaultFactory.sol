// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {RolesAuthority, Authority} from "solmate/src/auth/authorities/RolesAuthority.sol";

import "./BoringVault.sol";
import "./AccountantWithYieldStreaming.sol";
import "./AccountantWithRateProviders.sol";
import "./TellerWithYieldStreaming.sol";
import "./TellerWithMultiAssetSupport.sol";

contract PrimeVaultFactory is Ownable {
    uint8 public constant MINTER_ROLE = 1;
    uint8 public constant ADMIN_ROLE = 1;
    uint8 public constant BORING_VAULT_ROLE = 4;
    uint8 public constant UPDATE_EXCHANGE_RATE_ROLE = 3;
    uint8 public constant STRATEGIST_ROLE = 7;
    uint8 public constant BURNER_ROLE = 8;
    uint8 public constant SOLVER_ROLE = 9;
    uint8 public constant QUEUE_ROLE = 10;
    uint8 public constant CAN_SOLVE_ROLE = 11;

    constructor() Ownable(msg.sender) {}

    function setup(
        RolesAuthority rolesAuthority,
        BoringVault boringVault,
        AccountantWithYieldStreaming accountant,
        TellerWithYieldStreaming teller
    ) external onlyOwner {
        // Setup roles authority.
        rolesAuthority.setRoleCapability(MINTER_ROLE, address(boringVault), BoringVault.enter.selector, true);
        rolesAuthority.setRoleCapability(BURNER_ROLE, address(boringVault), BoringVault.exit.selector, true);
        rolesAuthority.setRoleCapability(
            MINTER_ROLE,
            address(accountant),
            AccountantWithYieldStreaming.setFirstDepositTimestamp.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.pause.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.unpause.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.updateDelay.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.updateUpper.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.updateLower.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.updatePlatformFee.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            ADMIN_ROLE,
            address(accountant),
            AccountantWithRateProviders.updatePayoutAddress.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            UPDATE_EXCHANGE_RATE_ROLE,
            address(accountant),
            AccountantWithRateProviders.updateExchangeRate.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            BORING_VAULT_ROLE,
            address(accountant),
            AccountantWithRateProviders.claimFees.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            STRATEGIST_ROLE,
            address(accountant),
            AccountantWithYieldStreaming.vestYield.selector,
            true
        );
        rolesAuthority.setRoleCapability(
            STRATEGIST_ROLE,
            address(accountant),
            bytes4(keccak256("updateExchangeRate()")),
            true
        );
        rolesAuthority.setRoleCapability(
            MINTER_ROLE,
            address(accountant),
            bytes4(keccak256("updateCumulative()")),
            true
        );
        rolesAuthority.setPublicCapability(address(teller), TellerWithMultiAssetSupport.deposit.selector, true);
        rolesAuthority.setPublicCapability(
            address(teller),
            TellerWithMultiAssetSupport.depositWithPermit.selector,
            true
        );
        rolesAuthority.setPublicCapability(address(teller), TellerWithYieldStreaming.withdraw.selector, true);

        // Allow the boring vault to receive ETH.
        rolesAuthority.setPublicCapability(address(boringVault), bytes4(0), true);

        rolesAuthority.setUserRole(address(accountant), MINTER_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), ADMIN_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), UPDATE_EXCHANGE_RATE_ROLE, true);
        rolesAuthority.setUserRole(address(boringVault), BORING_VAULT_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), ADMIN_ROLE, true);
        rolesAuthority.setUserRole(address(teller), MINTER_ROLE, true);
        rolesAuthority.setUserRole(address(teller), BURNER_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), STRATEGIST_ROLE, true);
        rolesAuthority.setUserRole(address(accountant), STRATEGIST_ROLE, true);
        rolesAuthority.setUserRole(address(teller), STRATEGIST_ROLE, true);
    }
}
