// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * @dev Enum defining the types of strategies supported by the vault system
 */
enum StrategyKind {
    SingleAsset,
    PairAsset
}

/**
 * @dev Base strategy errors
 */
error ZeroAddress();
error ZeroAmount();
error InvalidArrayLength();
error TokenNotFound();
error TokenIsBpt();
error InsufficientLiquidity();
error InsufficientBalance();
error SlippageExceeded();
error NotVault();
error PairNotActive();
error InvalidTokens();
error NoSupply();
error NoLiquidity();
error NotCurator();
error InsufficientOut();
error NotAdmin();
error ZeroAmounts();
error InvalidTreasury();
error InvalidToken();

/**
 * @title IStrategyBase
 * @dev Base interface that all strategies must implement
 */
interface IStrategyBase {
    /**
     * @dev Returns the vault address that owns this strategy
     * @return Address of the vault contract
     */
    function vault() external view returns (address);

    /**
     * @dev Returns the kind of strategy
     * @return StrategyKind enum value (SingleAsset or PairAsset)
     */
    function kind() external view returns (StrategyKind);
}

/**
 * @title ISingleAssetStrategy
 * @dev Interface for strategies that manage a single asset type
 */
interface ISingleAssetStrategy is IStrategyBase {
    /**
     * @dev Deposits tokens into the strategy
     * @param token Address of the token to deposit
     * @param amountWant Amount of tokens to deposit
     * @return amountOut Actual amount deposited into the strategy
     */
    function deposit(address token, uint256 amountWant) external returns (uint256 amountOut);

    /**
     * @dev Withdraws tokens from the strategy back to the vault
     * @param token Address of the token to withdraw
     * @param amountWant Amount of tokens requested to withdraw
     * @return outWant Actual amount withdrawn from the strategy
     */
    function withdraw(address token, uint256 amountWant) external returns (uint256 outWant);

    /**
     * @dev Withdraws all tokens managed by the strategy back to the vault
     * @param token Address of the token to withdraw
     * @return outWant Total amount withdrawn from the strategy
     */
    function withdrawAll(address token) external returns (uint256 outWant);

    /**
     * @dev Harvests rewards from the strategy
     * @param token Address of the token being harvested
     * @return rewardTokens Array of reward token addresses harvested
     * @return amounts Array of amounts corresponding to each reward token
     */
    function harvest(address token) external returns (address[] memory rewardTokens, uint256[] memory amounts);
}

/**
 * @title IPairAssetStrategy
 * @dev Interface for strategies that manage a pair of assets (e.g., LP tokens)
 */
interface IPairAssetStrategy is IStrategyBase {
    /**
     * @dev Deposits both tokens into the strategy
     * @param tokenA Address of the first token
     * @param amountA Amount of first token to deposit
     * @param tokenB Address of the second token
     * @param amountB Amount of second token to deposit
     * @return outA Actual amount of tokenA deposited
     * @return outB Actual amount of tokenB deposited
     */
    function deposit(
        address tokenA,
        uint256 amountA,
        address tokenB,
        uint256 amountB
    ) external returns (uint256 outA, uint256 outB);

    /**
     * @dev Withdraws specified amounts of both tokens from the strategy
     * @param tokenA Address of the first token
     * @param amountA Amount of first token requested to withdraw
     * @param tokenB Address of the second token
     * @param amountB Amount of second token requested to withdraw
     * @return outA Amount of tokenA out from strategy positions
     * @return outB Amount of tokenB out from strategy positions
     */
    function withdrawByAmounts(
        address tokenA,
        uint256 amountA,
        address tokenB,
        uint256 amountB
    ) external returns (uint256 outA, uint256 outB);

    /**
     * @dev Withdraws all tokens managed by the strategy back to the vault
     * @param tokenA Address of the first token
     * @param tokenB Address of the second token
     * @return outA Total amount of tokenA withdrawn
     * @return outB Total amount of tokenB withdrawn
     */
    function withdrawAll(address tokenA, address tokenB) external returns (uint256 outA, uint256 outB);

    /**
     * @dev Harvests rewards from the strategy
     * @param tokenA Address of the first token
     * @param tokenB Address of the second token
     * @return rewardTokens Array of reward token addresses harvested
     * @return amounts Array of amounts corresponding to each reward token
     */
    function harvest(
        address tokenA,
        address tokenB
    ) external returns (address[] memory rewardTokens, uint256[] memory amounts);
}
