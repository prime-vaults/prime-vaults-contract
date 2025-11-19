// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PrimeAuth} from "../auth/PrimeAuth.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {IBeforeUpdateHook} from "../interfaces/hooks/IBeforeUpdateHook.sol";
import {BoringVault} from "./BoringVault.sol";

/**
 * @title Distributor
 * @author Prime Vaults
 * @notice A multi-reward distributor contract integrated with PrimeVault
 * @dev Automatically tracks vault share balances without requiring explicit staking
 * Users earn multiple reward tokens based on their vault share balance
 * Integrates as a IBeforeUpdateHook to update rewards on every vault transfer
 */
contract Distributor is PrimeAuth, ReentrancyGuard, IBeforeUpdateHook {
    using SafeTransferLib for ERC20;
    using FixedPointMathLib for uint256;

    // ========================================= STRUCTS =========================================

    struct RewardData {
        address rewardsDistributor;
        uint256 rewardsDuration;
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    // ========================================= STATE VARIABLES =========================================

    /// @notice The vault contract (reads balances directly)
    ERC20 public immutable vault;

    /// @notice Mapping from reward token address to its reward data
    mapping(address => RewardData) public rewardData;

    /// @notice Array of all reward token addresses
    address[] public rewardTokens;

    /// @notice user -> reward token -> amount of reward per token paid
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

    /// @notice user -> reward token -> accumulated rewards
    mapping(address => mapping(address => uint256)) public rewards;

    /// @notice Whether the contract is paused
    bool public paused;

    // ========================================= EVENTS =========================================

    event RewardAdded(uint256 reward);
    event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward);
    event RewardsDurationUpdated(address token, uint256 newDuration);
    event Recovered(address token, uint256 amount);
    event PausedUpdated(bool isPaused);

    // ========================================= ERRORS =========================================

    error Distributor__AlreadyAdded();
    error Distributor__NotAuthorized();
    error Distributor__RewardPeriodActive();
    error Distributor__ZeroDuration();
    error Distributor__CannotWithdrawRewardToken();
    error Distributor__Paused();

    // ========================================= CONSTRUCTOR =========================================

    /**
     * @notice Initializes the Distributor contract
     * @param _primeRBAC The PrimeRBAC contract for authentication
     * @param _vault The vault contract (source of share balances)
     */
    constructor(
        address _primeRBAC,
        address _vault
    ) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
        vault = ERC20(_vault);
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Add a new reward token to the contract
     * @param _rewardsToken The address of the reward token
     * @param _rewardsDistributor The address authorized to fund this reward
     * @param _rewardsDuration The duration over which rewards will be distributed
     * @dev Callable by OWNER_ROLE
     */
    function addReward(
        address _rewardsToken,
        address _rewardsDistributor,
        uint256 _rewardsDuration
    ) external requiresAuth {
        if (rewardData[_rewardsToken].rewardsDuration != 0) revert Distributor__AlreadyAdded();

        rewardTokens.push(_rewardsToken);
        rewardData[_rewardsToken].rewardsDistributor = _rewardsDistributor;
        rewardData[_rewardsToken].rewardsDuration = _rewardsDuration;
    }

    /**
     * @notice Update the rewards distributor for a reward token
     * @param _rewardsToken The reward token address
     * @param _rewardsDistributor The new distributor address
     * @dev Callable by OWNER_ROLE
     */
    function setRewardsDistributor(address _rewardsToken, address _rewardsDistributor) external requiresAuth {
        rewardData[_rewardsToken].rewardsDistributor = _rewardsDistributor;
    }

    /**
     * @notice Update the rewards duration for a reward token
     * @param _rewardsToken The reward token address
     * @param _rewardsDuration The new rewards duration
     * @dev Can only be called after the current reward period has finished
     * @dev Callable by the rewards distributor
     */
    function setRewardsDuration(address _rewardsToken, uint256 _rewardsDuration) external {
        if (block.timestamp <= rewardData[_rewardsToken].periodFinish) {
            revert Distributor__RewardPeriodActive();
        }
        if (rewardData[_rewardsToken].rewardsDistributor != msg.sender) revert Distributor__NotAuthorized();
        if (_rewardsDuration == 0) revert Distributor__ZeroDuration();

        rewardData[_rewardsToken].rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsToken, rewardData[_rewardsToken].rewardsDuration);
    }

    /**
     * @notice Pause or unpause the contract
     * @param _paused Whether to pause the contract
     * @dev Callable by OWNER_ROLE
     */
    function setPaused(bool _paused) external requiresAuth {
        paused = _paused;
        emit PausedUpdated(_paused);
    }

    /**
     * @notice Recover ERC20 tokens sent to the contract by mistake
     * @param tokenAddress The token to recover
     * @param tokenAmount The amount to recover
     * @dev Cannot recover active reward tokens
     * @dev Callable by OWNER_ROLE
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external requiresAuth {
        if (rewardData[tokenAddress].lastUpdateTime != 0) revert Distributor__CannotWithdrawRewardToken();

        ERC20(tokenAddress).safeTransfer(msg.sender, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    // ========================================= REWARD DISTRIBUTION FUNCTIONS =========================================

    /**
     * @notice Notify the contract of a new reward amount
     * @param _rewardsToken The reward token address
     * @param reward The amount of rewards to distribute
     * @dev Transfers reward tokens from caller to this contract
     * @dev Callable by the rewards distributor for this token
     */
    function notifyRewardAmount(address _rewardsToken, uint256 reward) external updateReward(address(0)) {
        if (rewardData[_rewardsToken].rewardsDistributor != msg.sender) revert Distributor__NotAuthorized();

        // Transfer reward tokens from distributor to this contract
        ERC20(_rewardsToken).safeTransferFrom(msg.sender, address(this), reward);

        if (block.timestamp >= rewardData[_rewardsToken].periodFinish) {
            rewardData[_rewardsToken].rewardRate = reward / rewardData[_rewardsToken].rewardsDuration;
        } else {
            uint256 remaining = rewardData[_rewardsToken].periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardData[_rewardsToken].rewardRate;
            rewardData[_rewardsToken].rewardRate = (reward + leftover) / rewardData[_rewardsToken].rewardsDuration;
        }

        rewardData[_rewardsToken].lastUpdateTime = block.timestamp;
        rewardData[_rewardsToken].periodFinish = block.timestamp + rewardData[_rewardsToken].rewardsDuration;

        emit RewardAdded(reward);
    }

    // ========================================= HOOK FUNCTIONS =========================================

    /**
     * @notice BeforeUpdate hook - updates rewards BEFORE balance changes
     * @param from The sender address (address(0) for mint)
     * @param to The recipient address (address(0) for burn)
     * @dev Called by vault BEFORE any balance change (mint/burn/transfer)
     * @dev Must update rewards based on OLD balances before they change
     * @dev Callable by vault only
     */
    function beforeUpdate(address from, address to, uint256 /* amount */, address /* operator */) external override {
        if (msg.sender != address(vault)) revert Distributor__NotAuthorized();
        if (paused) return; // Skip updates if paused

        // Update rewards for both parties BEFORE their balances change
        // address(0) means mint, skip sender update
        if (from != address(0)) {
            updateRewardForAccount(from);
        }
        // address(0) means burn, skip recipient update
        if (to != address(0)) {
            updateRewardForAccount(to);
        }
    }

    // ========================================= USER FUNCTIONS =========================================
    /**
     * @notice Claim accumulated rewards for specific tokens
     * @dev No staking required - rewards are based on vault share balance
     */
    function claimRewards(address[] memory _rewardTokens) public nonReentrant updateReward(msg.sender) {
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            address rwToken = _rewardTokens[i];
            uint256 reward = rewards[msg.sender][rwToken];

            if (reward > 0) {
                rewards[msg.sender][rwToken] = 0;
                ERC20(rwToken).safeTransfer(msg.sender, reward);
                emit RewardPaid(msg.sender, rwToken, reward);
            }
        }
    }

    // ========================================= VIEW FUNCTIONS =========================================

    /**
     * @notice Get the total supply of vault shares
     * @dev Reads directly from vault
     */
    function totalSupply() public view returns (uint256) {
        return vault.totalSupply();
    }

    /**
     * @notice Get the vault share balance of an account
     * @param account The account to query
     * @dev Reads directly from vault
     */
    function balanceOf(address account) public view returns (uint256) {
        return vault.balanceOf(account);
    }

    /**
     * @notice Get the last time rewards are applicable
     * @param _rewardsToken The reward token address
     */
    function lastTimeRewardApplicable(address _rewardsToken) public view returns (uint256) {
        return
            block.timestamp < rewardData[_rewardsToken].periodFinish
                ? block.timestamp
                : rewardData[_rewardsToken].periodFinish;
    }

    /**
     * @notice Calculate the current reward per token
     * @param _rewardsToken The reward token address
     */
    function rewardPerToken(address _rewardsToken) public view returns (uint256) {
        if (vault.totalSupply() == 0) {
            return rewardData[_rewardsToken].rewardPerTokenStored;
        }

        return
            rewardData[_rewardsToken].rewardPerTokenStored +
            ((lastTimeRewardApplicable(_rewardsToken) - rewardData[_rewardsToken].lastUpdateTime) *
                rewardData[_rewardsToken].rewardRate *
                1e18) /
                vault.totalSupply();
    }

    /**
     * @notice Calculate how much reward an account has earned
     * @param account The account to query
     * @param _rewardsToken The reward token address
     */
    function earned(address account, address _rewardsToken) public view returns (uint256) {
        return
            (vault.balanceOf(account) *
                (rewardPerToken(_rewardsToken) - userRewardPerTokenPaid[account][_rewardsToken])) /
                1e18 +
            rewards[account][_rewardsToken];
    }

    /**
     * @notice Get the total reward for the full duration
     * @param _rewardsToken The reward token address
     */
    function getRewardForDuration(address _rewardsToken) external view returns (uint256) {
        return rewardData[_rewardsToken].rewardRate * rewardData[_rewardsToken].rewardsDuration;
    }

    // ========================================= INTERNAL FUNCTIONS =========================================

    /**
     * @notice Updates reward accounting for a specific account
     * @param account The account to update
     * @dev Can be called publicly to manually update rewards before balance queries
     */
    function updateRewardForAccount(address account) public {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            rewardData[token].rewardPerTokenStored = rewardPerToken(token);
            rewardData[token].lastUpdateTime = lastTimeRewardApplicable(token);

            rewards[account][token] = earned(account, token);
            userRewardPerTokenPaid[account][token] = rewardData[token].rewardPerTokenStored;
        }
    }

    // ========================================= MODIFIERS =========================================

    /**
     * @notice Updates reward accounting for an account
     * @param account The account to update (address(0) updates global state only)
     */
    modifier updateReward(address account) {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            rewardData[token].rewardPerTokenStored = rewardPerToken(token);
            rewardData[token].lastUpdateTime = lastTimeRewardApplicable(token);

            if (account != address(0)) {
                rewards[account][token] = earned(account, token);
                userRewardPerTokenPaid[account][token] = rewardData[token].rewardPerTokenStored;
            }
        }
        _;
    }

    /**
     * @notice Ensures the contract is not paused
     */
    modifier notPaused() {
        if (paused) revert Distributor__Paused();
        _;
    }
}
