// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title SmartAccountRegistry
 * @author Prime Vaults
 * @notice Registry contract for mapping ERC-4337 smart accounts to their owners
 * @dev Simple storage contract that allows smart accounts to register their owner addresses
 *
 * ## Purpose
 * ERC-4337 smart accounts are deployed at deterministic addresses but don't inherently store
 * owner information on-chain. This registry allows smart accounts to register their owner
 * for easy lookup and verification.
 *
 * ## Usage
 * Smart accounts call `registerOwner(address owner)` to associate themselves with an owner address.
 * Anyone can query `getOwner(address account)` to find the registered owner of a smart account.
 *
 * ## Security
 * - Only the smart account itself can register/update its owner
 * - No centralized control - fully permissionless
 * - Owners can be updated by the smart account at any time
 */
contract SmartAccountRegistry {
    // ========================================= EVENTS =========================================

    /**
     * @notice Emitted when a smart account registers or updates its owner
     * @param smartAccount The address of the smart account
     * @param owner The owner address being registered
     * @param previousOwner The previous owner (address(0) if first registration)
     */
    event OwnerRegistered(address indexed smartAccount, address indexed owner, address indexed previousOwner);

    // ========================================= STATE VARIABLES =========================================

    /**
     * @notice Mapping from smart account address to its registered owner
     * @dev smartAccount => owner
     */
    mapping(address => address) public owners;

    // ========================================= EXTERNAL FUNCTIONS =========================================

    /**
     * @notice Register or update the owner of the calling smart account
     * @param owner The owner address to register
     * @dev Can only be called by the smart account itself (msg.sender is the smart account)
     * @dev Emits OwnerRegistered event
     */
    function registerOwner(address owner) external {
        address previousOwner = owners[msg.sender];
        owners[msg.sender] = owner;

        emit OwnerRegistered(msg.sender, owner, previousOwner);
    }

    // ========================================= VIEW FUNCTIONS =========================================

    /**
     * @notice Get the registered owner of a smart account
     * @param smartAccount The address of the smart account to query
     * @return owner The registered owner address (address(0) if not registered)
     */
    function getOwner(address smartAccount) external view returns (address owner) {
        return owners[smartAccount];
    }

    /**
     * @notice Check if a smart account has registered an owner
     * @param smartAccount The address of the smart account to check
     * @return registered True if an owner is registered, false otherwise
     */
    function isRegistered(address smartAccount) external view returns (bool registered) {
        return owners[smartAccount] != address(0);
    }

    /**
     * @notice Verify if an address is the registered owner of a smart account
     * @param smartAccount The address of the smart account
     * @param owner The address to verify as owner
     * @return isOwner True if the address is the registered owner, false otherwise
     */
    function verifyOwner(address smartAccount, address owner) external view returns (bool isOwner) {
        return owners[smartAccount] == owner && owner != address(0);
    }
}
