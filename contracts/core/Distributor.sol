// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PrimeAuth} from "../auth/PrimeAuth.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {IBeforeUpdateHook} from "../interfaces/hooks/IBeforeUpdateHook.sol";
import {BoringVault} from "./BoringVault.sol";
import {Teller} from "./Teller.sol";

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
        address rewardsToken;
        uint256 rewardsDuration;
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    // ========================================= STATE VARIABLES =========================================

    /// @notice The vault contract (reads balances directly)
    ERC20 public immutable vault;

    Teller public immutable teller;

    /// @notice Mapping from reward token address to its reward data
    mapping(address => RewardData) public rewardData;

    /// @notice Array of all reward token addresses
    address[] public rewardTokens;

    /// @notice user -> reward token -> amount of reward per token paid
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

    /// @notice user -> reward token -> accumulated rewards
    mapping(address => mapping(address => uint256)) public rewards;

    /// @notice Compound fee percentage (in basis points, 10000 = 100%)
    uint256 public compoundFee;

    /// @notice Maximum compound fee (20%)
    uint256 public constant MAX_COMPOUND_FEE = 2000; // 20%

    /// @notice Precision for reward calculations (1e27 = 1e18 base + 1e9 extra precision)
    /// @dev Using 1e27 prevents rounding down to 0 for low-decimal reward tokens (e.g. USDC)
    uint256 private constant REWARD_PRECISION = 1e27;

    /// @notice Mapping of user address to whether they allow third-party compounding
    mapping(address => bool) public allowThirdPartyCompound;

    /// @notice Treasury address - holds reward tokens to pay users
    address public treasury;

    /// @notice Mapping of caller address to claimable compound fees
    mapping(address => uint256) public claimableCompoundFees;

    // ========================================= EVENTS =========================================

    event RewardAdded(uint256 reward);
    event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward, address to);
    event RewardsDurationUpdated(address token, uint256 newDuration);
    event Recovered(address token, uint256 amount);
    event CompoundReward(address indexed account, address indexed rewardToken, uint256 rewardAmount, uint256 shares, uint256 fee);
    event CompoundFeeUpdated(uint256 newFee);
    event ThirdPartyCompoundAllowed(address indexed user, bool allowed);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CompoundFeeAccrued(address indexed caller, uint256 fee);
    event CompoundFeeClaimed(address indexed caller, uint256 amount);

    // ========================================= ERRORS =========================================

    error Distributor__AlreadyAdded();
    error Distributor__NotAuthorized();
    error Distributor__RewardPeriodActive();
    error Distributor__ZeroDuration();
    error Distributor__CannotWithdrawRewardToken();
    error Distributor__Paused();
    error Distributor__CompoundFeeExceedsMaximum();
    error Distributor__ThirdPartyCompoundNotAllowed();

    // ========================================= CONSTRUCTOR =========================================

    /**
     * @notice Initializes the Distributor contract
     * @param _primeRBAC The PrimeRBAC contract for authentication
     * @param _teller The vault contract (source of share balances)
     */
    constructor(address _primeRBAC, address _teller) PrimeAuth(_primeRBAC, address(BoringVault(payable(Teller(_teller).vault())).authority())) {
        teller = Teller(_teller);
        vault = ERC20(teller.vault());
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Add a new reward token to the contract
     * @param _rewardsToken The address of the reward token
     * @param _rewardsDuration The duration over which rewards will be distributed
     * @dev Callable by PROTOCOL_ADMIN_ROLE
     */
    function addReward(address _rewardsToken, uint256 _rewardsDuration) external onlyProtocolAdmin {
        if (rewardData[_rewardsToken].rewardsDuration != 0) revert Distributor__AlreadyAdded();

        rewardTokens.push(_rewardsToken);
        rewardData[_rewardsToken] = RewardData({
            rewardsToken: _rewardsToken,
            rewardsDuration: _rewardsDuration,
            periodFinish: 0,
            rewardRate: 0,
            lastUpdateTime: 0,
            rewardPerTokenStored: 0
        });
    }

    /**
     * @notice Update the rewards duration for a reward token
     * @param _rewardsToken The reward token address
     * @param _rewardsDuration The new rewards duration
     * @dev Can only be called after the current reward period has finished
     * @dev Callable by the rewards distributor
     */
    function setRewardsDuration(address _rewardsToken, uint256 _rewardsDuration) external onlyOperator {
        if (block.timestamp <= rewardData[_rewardsToken].periodFinish) {
            revert Distributor__RewardPeriodActive();
        }
        if (_rewardsDuration == 0) revert Distributor__ZeroDuration();

        rewardData[_rewardsToken].rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsToken, rewardData[_rewardsToken].rewardsDuration);
    }

    /**
     * @notice Set the compound fee percentage
     * @param _compoundFee The new compound fee in basis points (10000 = 100%)
     * @dev Callable by PROTOCOL_ADMIN_ROLE
     * @dev Maximum fee is 20% (2000 basis points)
     */
    function setCompoundFee(uint256 _compoundFee) external onlyProtocolAdmin {
        if (_compoundFee > MAX_COMPOUND_FEE) revert Distributor__CompoundFeeExceedsMaximum();
        compoundFee = _compoundFee;
        emit CompoundFeeUpdated(_compoundFee);
    }

    /**
     * @notice Set the treasury address
     * @param _treasury The new treasury address (address(0) to disable)
     * @dev Callable by PROTOCOL_ADMIN_ROLE
     * @dev If treasury is set, rewards are transferred from treasury instead of contract balance
     */
    function setTreasury(address _treasury) external onlyProtocolAdmin {
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Recover ERC20 tokens sent to the contract by mistake
     * @param tokenAddress The token to recover
     * @param tokenAmount The amount to recover
     * @dev Cannot recover active reward tokens
     * @dev Callable by PROTOCOL_ADMIN_ROLE
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyProtocolAdmin {
        if (rewardData[tokenAddress].lastUpdateTime != 0) revert Distributor__CannotWithdrawRewardToken();

        ERC20(tokenAddress).safeTransfer(msg.sender, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    // ========================================= REWARD DISTRIBUTION FUNCTIONS =========================================

    /**
     * @notice Notify the contract of a new reward amount
     * @param _rewardsToken The reward token address
     * @param reward The amount of rewards to distribute
     * @dev Does NOT transfer tokens - admin promises to deposit later
     * @dev Use getRewardDebt() to check how much needs to be deposited
     * @dev Callable by OPERATOR_ROLE
     */
    function notifyRewardAmount(address _rewardsToken, uint256 reward) external onlyOperator updateReward(address(0)) {
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
     * @dev Called by Teller BEFORE any balance change (mint/burn/transfer)
     * @dev Must update rewards based on OLD balances before they change
     * @dev Callable by Teller only
     */
    function beforeUpdate(address from, address to, uint256 /* amount */, address /* operator */) public requiresAuth {
        if (isPaused) revert Distributor__Paused();

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
     * @notice Claim accumulated rewards for a single token
     * @dev No staking required - rewards are based on vault share balance
     * @param _account The account to claim rewards for
     * @param _rewardToken The reward token address to claim
     * @param _to The address to send claimed rewards to
     * @return rewardAmount The amount of reward token claimed
     */
    function _claimReward(address _account, address _rewardToken, address _to) internal updateReward(_account) returns (uint256 rewardAmount) {
        rewardAmount = rewards[_account][_rewardToken];
        if (rewardAmount > 0) {
            rewards[_account][_rewardToken] = 0;

            // If treasury is set, transfer from treasury. Otherwise use contract balance
            if (treasury != address(0)) {
                ERC20(_rewardToken).safeTransferFrom(treasury, _to, rewardAmount);
            } else {
                ERC20(_rewardToken).safeTransfer(_to, rewardAmount);
            }

            emit RewardPaid(_account, _rewardToken, rewardAmount, _to);
        }
    }

    /**
     * @notice Claim accumulated rewards for multiple tokens
     * @dev No staking required - rewards are based on vault share balance
     * @param _rewardTokens Array of reward token addresses to claim
     * @return rewardsOut Array of amounts claimed for each reward token
     */
    function claimRewards(address[] memory _rewardTokens) public requiresAuth returns (uint256[] memory rewardsOut) {
        if (isPaused) revert Distributor__Paused();

        rewardsOut = new uint256[](_rewardTokens.length);
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            rewardsOut[i] = _claimReward(msg.sender, _rewardTokens[i], msg.sender);
        }
    }

    /**
     * @notice Operator claims accumulated rewards on behalf of user
     * @dev Rewards are sent to the user's wallet, not the operator
     * @dev Only callable by OPERATOR_ROLE
     * @param _account The account to claim rewards for
     * @param _rewardTokens Array of reward token addresses to claim
     * @return rewardsOut Array of amounts claimed for each reward token
     */
    function claimRewardsFor(address _account, address[] memory _rewardTokens) external onlyOperator returns (uint256[] memory rewardsOut) {
        if (isPaused) revert Distributor__Paused();

        rewardsOut = new uint256[](_rewardTokens.length);
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            rewardsOut[i] = _claimReward(_account, _rewardTokens[i], _account);
        }
    }

    /**
     * @notice Allow or disallow third-party compounding
     * @param _allowed Whether to allow third parties to compound rewards for the user
     * @dev Publicly callable by anyone for their own account
     */
    function setAllowThirdPartyCompound(bool _allowed) external requiresAuth {
        allowThirdPartyCompound[msg.sender] = _allowed;
        emit ThirdPartyCompoundAllowed(msg.sender, _allowed);
    }

    /**
     * @notice Claim accumulated compound fees
     * @dev Transfers all accrued fees from third-party compounding to the caller
     * @return amount The amount of fees claimed
     */
    function claimCompoundFees() external nonReentrant requiresAuth returns (uint256 amount) {
        if (isPaused) revert Distributor__Paused();

        amount = claimableCompoundFees[msg.sender];
        if (amount > 0) {
            claimableCompoundFees[msg.sender] = 0;

            ERC20 asset = BoringVault(payable(address(vault))).asset();
            asset.safeTransfer(msg.sender, amount);

            emit CompoundFeeClaimed(msg.sender, amount);
        }
    }

    /**
     * @notice Compounds a specific reward token by claiming and re-depositing it.
     * @dev Can be called by the user themselves (no fee) or by third parties (with fee if enabled).
     * @dev Only works with tokens that can be deposited into the vault (typically the base asset).
     * @param _account The account to compound rewards for
     */
    function compoundReward(address _account) external requiresAuth {
        _compoundRewardInternal(_account);
    }

    /**
     * @notice Batch compound rewards for multiple accounts in a single transaction.
     * @dev Applies the same rules as `compoundReward` for each account.
     *      - If caller != account, the account must have enabled third-party compounding.
     *      - Fees (if any) accrue to the caller per-account.
     * @param _accounts The list of accounts to compound for
     */
    function compoundRewardBatch(address[] calldata _accounts) external requiresAuth {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _compoundRewardInternal(_accounts[i]);
        }
    }

    function _compoundRewardInternal(address _account) internal updateReward(_account) {
        if (isPaused) revert Distributor__Paused();

        ERC20 asset = BoringVault(payable(address(vault))).asset();
        // Check authorization: user can compound for themselves, or third party if allowed
        if (msg.sender != _account) {
            if (!allowThirdPartyCompound[_account]) {
                revert Distributor__ThirdPartyCompoundNotAllowed();
            }
        }

        uint256 rewardAmount = rewards[_account][address(asset)];
        if (rewardAmount > 0) {
            rewards[_account][address(asset)] = 0;

            uint256 fee = 0;
            uint256 amountToCompound = rewardAmount;

            // If treasury is set, transfer from treasury to this contract first
            if (treasury != address(0)) {
                asset.safeTransferFrom(treasury, address(this), rewardAmount);
            }

            // Charge fee if third party is calling and fee is set
            if (msg.sender != _account && compoundFee > 0) {
                fee = (rewardAmount * compoundFee) / 1e4;
                amountToCompound = rewardAmount - fee;

                // Accrue fee to caller's claimable balance instead of transferring immediately
                if (fee > 0) {
                    claimableCompoundFees[msg.sender] += fee;
                    emit CompoundFeeAccrued(msg.sender, fee);
                }
            }

            // Compound remaining amount
            if (amountToCompound > 0) {
                asset.safeApprove(address(vault), amountToCompound);
                uint256 shares = teller.bulkDeposit(amountToCompound, 0, _account);
                emit CompoundReward(_account, address(asset), amountToCompound, shares, fee);
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
        return block.timestamp < rewardData[_rewardsToken].periodFinish ? block.timestamp : rewardData[_rewardsToken].periodFinish;
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
            ((lastTimeRewardApplicable(_rewardsToken) - rewardData[_rewardsToken].lastUpdateTime) * rewardData[_rewardsToken].rewardRate * REWARD_PRECISION) /
                vault.totalSupply();
    }

    /**
     * @notice Calculate how much reward an account has earned
     * @param account The account to query
     * @param _rewardsToken The reward token address
     */
    function earned(address account, address _rewardsToken) public view returns (uint256) {
        return
            (vault.balanceOf(account) * (rewardPerToken(_rewardsToken) - userRewardPerTokenPaid[account][_rewardsToken])) / REWARD_PRECISION +
            rewards[account][_rewardsToken];
    }

    /**
     * @notice Get the total reward for the full duration
     * @param _rewardsToken The reward token address
     */
    function getRewardForDuration(address _rewardsToken) external view returns (uint256) {
        return rewardData[_rewardsToken].rewardRate * rewardData[_rewardsToken].rewardsDuration;
    }

    /**
     * @notice Calculate total reward debt (how much needs to be deposited)
     * @param _rewardsToken The reward token address
     * @return debt The amount of reward tokens that should be in the contract to cover all promises
     * @dev This is the total amount users can claim based on current rewards accounting
     * @dev Admin should deposit (debt - currentBalance) to fulfill promises
     */
    function getRewardDebt(address _rewardsToken) external view returns (uint256 debt) {
        uint256 currentTime = block.timestamp;
        uint256 applicableTime = currentTime < rewardData[_rewardsToken].periodFinish ? currentTime : rewardData[_rewardsToken].periodFinish;

        // Calculate total rewards distributed so far
        uint256 timeElapsed = applicableTime > rewardData[_rewardsToken].lastUpdateTime ? applicableTime - rewardData[_rewardsToken].lastUpdateTime : 0;

        uint256 rewardsSinceLastUpdate = timeElapsed * rewardData[_rewardsToken].rewardRate;

        // Total debt includes:
        // 1. Already accumulated reward per token * total supply
        // 2. New rewards since last update
        uint256 supply = vault.totalSupply();
        if (supply > 0) {
            uint256 currentRewardPerToken = rewardData[_rewardsToken].rewardPerTokenStored + (rewardsSinceLastUpdate * REWARD_PRECISION) / supply;
            debt = (currentRewardPerToken * supply) / REWARD_PRECISION;
        }
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

    // =========================== VIEW HELPERS FOR FRONTEND ===========================

    /**
     * @notice Get all rewards tokens with full RewardData
     */
    function getRewards() external view returns (RewardData[] memory) {
        RewardData[] memory data = new RewardData[](rewardTokens.length);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            data[i] = rewardData[rewardTokens[i]];
        }
        return data;
    }
}
