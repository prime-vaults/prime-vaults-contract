// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title SmartAccountRegistry
 * @author Prime Vaults
 * @notice Optimized registry for mapping ERC-4337 smart accounts to their owners with efficient batch querying
 * @dev Allows smart accounts to register their owner addresses and provides efficient enumeration without event listening
 *
 * ## Key Features
 * - Direct on-chain enumeration of all registered accounts
 * - Efficient batch queries with pagination support
 * - No need to listen to events for getting full registry state
 * - Gas-optimized storage with minimal redundancy
 *
 * ## Usage
 * - Smart accounts call `registerOwner(address owner)` to register/update their owner
 * - Query individual owners with `getOwner(address account)`
 * - Get full list with `getAllRegistrations()` or use pagination for large datasets
 * - Use `getRegistrationsPaginated(start, limit)` for efficient batch queries
 *
 * ## Security
 * - Only the smart account itself can register/update its owner
 * - Fully permissionless - no centralized control
 * - Owners can be updated at any time by the smart account
 */
contract SmartAccountRegistry {
    // ========================================= EVENTS =========================================

    /**
     * @notice Emitted when a smart account registers or updates its owner
     * @param smartAccount The address of the smart account
     * @param owner The new owner address being registered
     * @param previousOwner The previous owner (address(0) if first registration)
     */
    event OwnerRegistered(address indexed smartAccount, address indexed owner, address indexed previousOwner);

    // ========================================= STATE VARIABLES =========================================

    /**
     * @notice Mapping from smart account address to its registered owner
     * @dev smartAccount => owner address
     */
    mapping(address => address) public owners;

    /**
     * @notice Array of all registered smart account addresses
     * @dev Enables enumeration without event listening. Once added, accounts remain in array.
     */
    address[] private _registeredAccounts;

    /**
     * @notice Mapping to check if an account has been registered
     * @dev smartAccount => registration status. Used to prevent duplicate entries in array.
     */
    mapping(address => bool) private _isRegistered;

    // ========================================= EXTERNAL FUNCTIONS =========================================

    /**
     * @notice Register or update the owner of the calling smart account
     * @param owner The owner address to register
     * @dev Can only be called by the smart account itself (msg.sender is the smart account)
     * @dev On first registration, adds account to enumerable list
     * @dev Emits OwnerRegistered event with previous owner for tracking updates
     */
    function registerOwner(address owner) external {
        address previousOwner = owners[msg.sender];
        owners[msg.sender] = owner;

        // Add to enumeration list on first registration
        if (!_isRegistered[msg.sender]) {
            _registeredAccounts.push(msg.sender);
            _isRegistered[msg.sender] = true;
        }

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
     * @notice Check if a smart account has been registered
     * @param smartAccount The address of the smart account to check
     * @return True if the account has been registered at least once, false otherwise
     */
    function isRegistered(address smartAccount) external view returns (bool) {
        return _isRegistered[smartAccount];
    }

    /**
     * @notice Verify if an address is the registered owner of a smart account
     * @param smartAccount The address of the smart account
     * @param owner The address to verify as owner
     * @return True if the address is the registered owner and not address(0), false otherwise
     */
    function verifyOwner(address smartAccount, address owner) external view returns (bool) {
        return owners[smartAccount] == owner && owner != address(0);
    }

    /**
     * @notice Get the total number of registered smart accounts
     * @return The total count of unique accounts that have registered
     */
    function getRegisteredAccountCount() external view returns (uint256) {
        return _registeredAccounts.length;
    }

    /**
     * @notice Get a smart account address by its index in the registry
     * @param index The index in the registered accounts array
     * @return The smart account address at the given index
     * @dev Useful for iterating through all accounts externally
     * @dev Reverts if index is out of bounds
     */
    function getAccountByIndex(uint256 index) external view returns (address) {
        require(index < _registeredAccounts.length, "Index out of bounds");
        return _registeredAccounts[index];
    }

    /**
     * @notice Get all registered smart accounts and their current owners
     * @return accounts Array of all registered smart account addresses
     * @return accountOwners Array of corresponding owner addresses
     * @dev Returns parallel arrays where accounts[i] is owned by accountOwners[i]
     * @dev WARNING: Gas-intensive for large datasets. Use pagination for production.
     * @dev This function enables getting full registry state without listening to events
     */
    function getAllRegistrations() external view returns (address[] memory accounts, address[] memory accountOwners) {
        uint256 length = _registeredAccounts.length;
        accounts = new address[](length);
        accountOwners = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            address account = _registeredAccounts[i];
            accounts[i] = account;
            accountOwners[i] = owners[account];
        }

        return (accounts, accountOwners);
    }

    /**
     * @notice Get registered smart accounts and their owners with pagination
     * @param startIndex Starting index in the registered accounts array (inclusive)
     * @param limit Maximum number of accounts to return
     * @return accounts Array of smart account addresses
     * @return accountOwners Array of corresponding owner addresses
     * @return total Total number of registered accounts (for pagination calculation)
     * @dev Returns parallel arrays where accounts[i] is owned by accountOwners[i]
     * @dev If startIndex >= total, returns empty arrays
     * @dev If startIndex + limit > total, returns from startIndex to end
     * @dev Recommended for production use with large registries
     *
     * Example: To get all accounts in pages of 100:
     * - Page 1: getRegistrationsPaginated(0, 100)
     * - Page 2: getRegistrationsPaginated(100, 100)
     * - Continue until startIndex >= total
     */
    function getRegistrationsPaginated(
        uint256 startIndex,
        uint256 limit
    ) external view returns (address[] memory accounts, address[] memory accountOwners, uint256 total) {
        total = _registeredAccounts.length;

        // Return empty arrays if start index is beyond total
        if (startIndex >= total) {
            return (new address[](0), new address[](0), total);
        }

        // Calculate actual end index
        uint256 endIndex = startIndex + limit;
        if (endIndex > total) {
            endIndex = total;
        }

        uint256 resultLength = endIndex - startIndex;
        accounts = new address[](resultLength);
        accountOwners = new address[](resultLength);

        // Fill result arrays
        for (uint256 i = 0; i < resultLength; i++) {
            address account = _registeredAccounts[startIndex + i];
            accounts[i] = account;
            accountOwners[i] = owners[account];
        }

        return (accounts, accountOwners, total);
    }

    /**
     * @notice Get registered accounts by explicit index range
     * @param startIndex Starting index (inclusive)
     * @param endIndex Ending index (exclusive)
     * @return accounts Array of smart account addresses in the range
     * @return accountOwners Array of corresponding owner addresses
     * @dev Returns parallel arrays where accounts[i] is owned by accountOwners[i]
     * @dev Reverts if range is invalid (startIndex >= endIndex or endIndex > length)
     * @dev Use this when you need precise control over the range
     *
     * Example: To get accounts 10-19 (10 accounts):
     * - getRegistrationsByRange(10, 20)
     */
    function getRegistrationsByRange(
        uint256 startIndex,
        uint256 endIndex
    ) external view returns (address[] memory accounts, address[] memory accountOwners) {
        require(startIndex < endIndex, "Invalid range: start must be less than end");
        require(endIndex <= _registeredAccounts.length, "Invalid range: end exceeds array length");

        uint256 resultLength = endIndex - startIndex;
        accounts = new address[](resultLength);
        accountOwners = new address[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            address account = _registeredAccounts[startIndex + i];
            accounts[i] = account;
            accountOwners[i] = owners[account];
        }

        return (accounts, accountOwners);
    }

    /**
     * @notice Batch query owners for multiple smart accounts
     * @param smartAccounts Array of smart account addresses to query
     * @return accountOwners Array of owner addresses corresponding to input accounts
     * @dev accountOwners[i] is the owner of smartAccounts[i]
     * @dev Returns address(0) for accounts that haven't registered
     * @dev Useful for checking ownership of a specific set of accounts
     */
    function getOwnersBatch(address[] calldata smartAccounts) external view returns (address[] memory accountOwners) {
        uint256 length = smartAccounts.length;
        accountOwners = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            accountOwners[i] = owners[smartAccounts[i]];
        }

        return accountOwners;
    }

    /**
     * @notice Batch check registration status for multiple smart accounts
     * @param smartAccounts Array of smart account addresses to check
     * @return registered Array of booleans indicating registration status
     * @dev registered[i] indicates if smartAccounts[i] has been registered
     */
    function isRegisteredBatch(address[] calldata smartAccounts) external view returns (bool[] memory registered) {
        uint256 length = smartAccounts.length;
        registered = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            registered[i] = _isRegistered[smartAccounts[i]];
        }

        return registered;
    }

    /**
     * @notice Batch verify ownership for multiple smart account-owner pairs
     * @param smartAccounts Array of smart account addresses
     * @param ownersToVerify Array of owner addresses to verify (must match length of smartAccounts)
     * @return isOwner Array of booleans indicating verification results
     * @dev isOwner[i] is true if ownersToVerify[i] owns smartAccounts[i]
     * @dev Arrays must be the same length
     */
    function verifyOwnerBatch(
        address[] calldata smartAccounts,
        address[] calldata ownersToVerify
    ) external view returns (bool[] memory isOwner) {
        require(smartAccounts.length == ownersToVerify.length, "Array length mismatch");

        uint256 length = smartAccounts.length;
        isOwner = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            isOwner[i] = owners[smartAccounts[i]] == ownersToVerify[i] && ownersToVerify[i] != address(0);
        }

        return isOwner;
    }
}
