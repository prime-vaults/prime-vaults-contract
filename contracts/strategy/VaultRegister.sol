// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStrategyBase, StrategyKind} from "../interfaces/IStrategy.sol";

/// @title VaultRegister
/// @notice Registry that manages approved strategies for Vault contracts.
/// @dev
/// - Only the contract owner can add, remove, or toggle strategies.
/// - Ensures that only verified, valid contracts are added.
/// - Keeps an efficient on-chain list of strategies for iteration and indexing.
contract VaultRegister is Ownable {
    // -------- Errors --------
    error StrategyExists();
    error StrategyNotFound();
    error NotAContract();
    error KindMismatch();
    error VaultMismatch();

    // -------- Events --------
    /// @notice Emitted when a new strategy is added to the registry.
    event StrategyAdded(address indexed strategy, StrategyKind kind, address indexed vault, address indexed by);

    /// @notice Emitted when a strategy is permanently removed.
    event StrategyRemoved(address indexed strategy, address indexed by);

    /// @notice Emitted when a strategy’s active status is updated.
    event StrategyActivated(address indexed strategy, bool active, address indexed by);

    struct StrategyInfo {
        StrategyKind kind; // Type of strategy (SingleAsset or PairAsset)
        bool active; // Whether the strategy is active
        address vault; // Vault that owns or uses this strategy
        uint40 addedAt; // Timestamp of addition
        uint216 _reserved; // Reserved for future upgrades
    }

    /// @dev Mapping from strategy address → info record.
    mapping(address => StrategyInfo) public strategies;

    /// @dev Efficient list + index mapping for enumeration and O(1) removals.
    address[] private _list;
    mapping(address => uint256) private _indexPlusOne; // index + 1 (0 means not exists)

    constructor() Ownable(msg.sender) {}

    // -------- Owner operations --------

    /// @notice Adds a new strategy and marks it as active.
    /// @param stra The strategy address to register.
    /// @param expectedVault The expected vault.
    function addStrategy(address stra, address expectedVault) external onlyOwner {
        if (_indexPlusOne[stra] != 0) revert StrategyExists();
        if (!_isContract(stra)) revert NotAContract();

        // Fetch info directly from strategy contract
        IStrategyBase s = IStrategyBase(stra);
        StrategyKind realKind = s.kind();
        address realVault = s.vault();
        if (realVault != expectedVault) revert VaultMismatch();
        // Store info
        strategies[stra] = StrategyInfo({
            kind: realKind,
            active: true,
            vault: realVault,
            addedAt: uint40(block.timestamp),
            _reserved: 0
        });

        _indexPlusOne[stra] = _list.length + 1;
        _list.push(stra);

        emit StrategyAdded(stra, realKind, realVault, msg.sender);
        emit StrategyActivated(stra, true, msg.sender);
    }

    /// @notice Removes a strategy completely from the registry (swap-and-pop).
    /// @dev This operation is irreversible and deletes all associated data.
    function removeStrategy(address stra) external onlyOwner {
        if (_indexPlusOne[stra] == 0) revert StrategyNotFound();

        uint256 idx = _indexPlusOne[stra] - 1;
        uint256 last = _list.length - 1;
        if (idx != last) {
            address moved = _list[last];
            _list[idx] = moved;
            _indexPlusOne[moved] = idx + 1;
        }
        _list.pop();
        delete _indexPlusOne[stra];
        delete strategies[stra];

        emit StrategyRemoved(stra, msg.sender);
    }

    /// @notice Enables or disables a strategy without removing it.
    function setActive(address stra, bool active) external onlyOwner {
        if (_indexPlusOne[stra] == 0) revert StrategyNotFound();
        strategies[stra].active = active;
        emit StrategyActivated(stra, active, msg.sender);
    }

    // -------- View helpers --------

    /// @notice Returns the total number of registered strategies.
    function count() external view returns (uint256) {
        return _list.length;
    }

    /// @notice Returns the full list of registered strategies.
    /// @dev Be cautious — large lists can be gas-heavy.
    function getStrategies() external view returns (address[] memory) {
        return _list;
    }

    /// @notice Returns a paginated list of strategies for front-end pagination.
    /// @param offset Start index.
    /// @param limit Max number of results to return.
    function list(uint256 offset, uint256 limit) external view returns (address[] memory slice) {
        uint256 n = _list.length;
        if (offset >= n) return new address[](0);
        uint256 end = offset + limit;
        if (end > n) end = n;

        slice = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            slice[i - offset] = _list[i];
        }
    }

    /// @notice Returns true if a strategy exists in the registry.
    function exists(address stra) external view returns (bool) {
        return _indexPlusOne[stra] != 0;
    }

    /// @notice Returns whether a strategy is currently active.
    function isActive(address stra) external view returns (bool) {
        return strategies[stra].active;
    }

    // -------- Internal utils --------

    /// @dev Checks whether an address is a deployed contract.
    function _isContract(address a) internal view returns (bool) {
        return a.code.length > 0;
    }
}
