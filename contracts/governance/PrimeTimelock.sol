// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title PrimeTimelock
 * @author Prime Vaults
 * @notice Timelock controller for Prime Vaults role management
 * @dev Wrapper around OpenZeppelin's TimelockController for role operations
 *
 * PRIMARY PURPOSE: Control OWNER_ROLE in PrimeRBAC to prevent admin rug pulls
 *
 * This contract enforces a 48-hour delay on critical role changes:
 * - Granting roles (especially OWNER_ROLE)
 * - Revoking roles
 * - Any changes to RolesAuthority
 *
 * Other operations (fees, rewards) don't need timelock because they have:
 * - Built-in safety limits (max 20% fee, etc.)
 * - Business logic constraints
 * - Pause mechanism for emergencies
 *
 * Recommended configuration:
 * - Minimum delay: 48 hours (172800 seconds)
 * - Proposers: Multi-sig wallet (3-of-5 or higher)
 * - Executors: Multi-sig wallet or address(0) for anyone after delay
 * - Admin: Should be renounced after setup (transfer to address(0))
 */
contract PrimeTimelock is TimelockController {
    /**
     * @notice Initialize the timelock controller
     * @param minDelay Minimum delay in seconds before an operation can be executed (recommended: 48 hours = 172800)
     * @param proposers Array of addresses that can propose operations (recommend multi-sig)
     * @param executors Array of addresses that can execute operations (recommend multi-sig or address(0) for public)
     * @param admin Optional admin address that can manage roles (recommend renouncing after setup)
     *
     * @dev After deployment:
     * 1. Grant OWNER_ROLE in PrimeRBAC to this timelock address
     * 2. Renounce admin role by calling revokeRole(DEFAULT_ADMIN_ROLE, deployer)
     * 3. All role changes will now require 48h timelock delay
     *
     * Example usage:
     * ```
     * // Deploy
     * address[] memory proposers = new address[](1);
     * proposers[0] = multiSigAddress;
     *
     * address[] memory executors = new address[](1);
     * executors[0] = address(0); // Anyone can execute after delay
     *
     * PrimeTimelock timelock = new PrimeTimelock(
     *     172800,      // 48 hour delay
     *     proposers,   // Multi-sig can propose
     *     executors,   // Anyone can execute
     *     msg.sender   // Deployer is temp admin
     * );
     *
     * // Transfer OWNER_ROLE to timelock (prevents instant rug pull)
     * primeRBAC.grantRole(OWNER_ROLE, address(timelock));
     * primeRBAC.revokeRole(OWNER_ROLE, currentOwner);
     *
     * // Renounce admin (makes timelock fully decentralized)
     * timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), msg.sender);
     * ```
     */
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin)
    {}
}
