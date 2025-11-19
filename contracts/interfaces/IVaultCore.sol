// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import './IStrategy.sol';

/*---------- STRUCTS ----------*/

/**
 * @dev Defines withdrawal priority for allocations
 * @param kind Type of strategy (SingleAsset or PairAsset)
 * @param allocKey Unique identifier of the allocation
 */
struct WithdrawPriority {
    StrategyKind kind;
    bytes32 allocKey;
}

/**
 * @dev Single asset allocation data structure
 * @param strategy Address of the strategy contract
 * @param token Address of the allocated token
 * @param allocated Current amount allocated to the strategy
 * @param capWanted Target allocation amount
 * @param exists Flag indicating if allocation exists
 */
struct SingleAllocation {
    address strategy;
    address token;
    uint256 allocated;
    uint256 capWanted;
    bool exists;
}

/**
 * @dev Pair asset allocation data structure
 * @param strategy Address of the strategy contract
 * @param tokenA Address of the first token
 * @param tokenB Address of the second token
 * @param allocatedA Current amount allocated for token A
 * @param allocatedB Current amount allocated for token B
 * @param capWantedA Target allocation amount for token A
 * @param capWantedB Target allocation amount for token B
 * @param exists Flag indicating if allocation exists
 */
struct PairAllocation {
    address strategy;
    address tokenA;
    address tokenB;
    uint256 allocatedA;
    uint256 allocatedB;
    uint256 capWantedA;
    uint256 capWantedB;
    bool exists;
}

/**
 * @dev View struct for deposited token information
 * @param token Address of the deposited token
 * @param amount Amount deposited in the vault
 */
struct TokenDepositedView {
    address token;
    uint256 amount;
}

struct SwapParams {
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    bytes data;
    address to;
    uint256 value;
}
  bytes4 constant KX_SWAP_SELECTOR = 0xd2644d14;


    struct KxInput {
        address token;
        bool wrap;
        uint256 amount;
    }
    struct KxOutput {
        address token;
        bool unwrap;
        uint256 minAmountOut;
        address receiver;
    }
    struct KxSwapData {
        address router;
        bytes data;
    }
    struct KxFee {
        uint256 feeQuote;
        uint16 surplusFeeBps;
        uint16 refCode;
        uint16 referrerFeeBps;
    }

/*---------- ERRORS ----------*/

/// @dev Thrown when caller is not an admin
error VAULT__NOT_ADMIN();

/// @dev Thrown when caller is not a manager
error VAULT__NOT_MANAGER();

/// @dev Thrown when strategy is not active in registry
error VAULT__STRATEGY_NOT_ACTIVE();

/// @dev Thrown when strategy kind doesn't match expected type
error VAULT__INVALID_STRATEGY_KIND();

/// @dev Thrown when allocation key is not found
error VAULT__ALLOCATION_NOT_FOUND();

/// @dev Thrown when vault has insufficient idle balance for operation
error VAULT__INSUFFICIENT_IDLE_BALANCE();

/// @dev Thrown when caller is not the prime vault
error VAULT__NOT_PRIME_VAULT();

/// @dev Thrown when vault has insufficient total funds for withdrawal
error VAULT__INSUFFICIENT_FUNDS();

/// @dev Thrown when withdrawal from strategy fails
error VAULT__WITHDRAWAL_FAILED();

/// @dev Thrown when deposit to strategy fails
error VAULT__DEPOSIT_FAILED();

/// @dev Thrown when deposit amount is invalid
error VAULT__INVALID_DEPOSIT_AMOUNT();

error VAULT__INVALID_SWAP_ADDRESS();

error VAULT__INSUFFICIENT_BALANCE();


/*---------- EVENTS ----------*/

/**
 * @dev Emitted when tokens are deposited into the vault
 * @param token Address of the deposited token
 * @param amount Amount deposited
 * @param caller Address that initiated the deposit
 */
event Deposited(address indexed token, uint256 amount, address indexed caller);

/**
 * @dev Emitted when tokens are withdrawn from the vault
 * @param token Address of the withdrawn token
 * @param amount Amount withdrawn
 * @param caller Address that initiated the withdrawal
 */
event Withdrawn(address indexed token, uint256 amount, address indexed caller);

/**
 * @dev Emitted when rewards are harvested from an allocation
 * @param key Unique identifier of the allocation
 * @param rewardTokens Array of reward token addresses
 * @param amounts Array of reward amounts
 */
event Harvest(bytes32 indexed key, address[] rewardTokens, uint256[] amounts);

/**
 * @dev Emitted when a pair allocation is executed
 * @param key Unique identifier of the allocation
 * @param allocatedA Final allocated amount of token A
 * @param allocatedB Final allocated amount of token B
 * @param targetA Target amount for token A
 * @param targetB Target amount for token B
 */
event AllocationExecuted(
    bytes32 indexed key,
    uint256 allocatedA,
    uint256 allocatedB,
    uint256 targetA,
    uint256 targetB
);

/*---------- INTERFACES ----------*/

/**
 * @title IVaultRegistry
 * @dev Interface for the vault registry that manages strategy information
 */
interface IVaultRegistry {
    /**
     * @dev Strategy information structure
     * @param kind Type of strategy (SingleAsset or PairAsset)
     * @param active Whether the strategy is currently active
     */
    struct StrategyInfo {
        StrategyKind kind;
        bool active;
    }

    /**
     * @dev Returns strategy information for a given strategy address
     * @param stra Address of the strategy
     * @return kind Type of the strategy
     * @return active Activation status of the strategy
     */
    function strategies(address stra) external view returns (StrategyKind kind, bool active);

    /**
     * @dev Returns all registered strategy addresses
     * @return Array of strategy addresses
     */
    function getStrategies() external view returns (address[] memory);
}

/**
 * @title IVaultManager
 * @dev Interface for vault manager functionality
 */
interface IVaultManager {
    /**
     * @dev Returns the treasury address
     * @return Address of the treasury
     */
    function treasury() external view returns (address);

    /**
     * @dev Sets a new treasury address (admin only)
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external;
}