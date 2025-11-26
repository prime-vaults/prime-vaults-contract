// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {WETH} from "solmate/src/tokens/WETH.sol";
import {BoringVault} from "./BoringVault.sol";
import {AccountantWithRateProviders} from "./AccountantWithRateProviders.sol";
import {TellerWithMultiAssetSupport} from "./TellerWithMultiAssetSupport.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";

import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";
import {IPausable} from "../interfaces/IPausable.sol";

import "../auth/PrimeAuth.sol";

contract DelayedWithdraw is PrimeAuth, ReentrancyGuard, IPausable {
    using SafeTransferLib for BoringVault;
    using SafeTransferLib for ERC20;
    using FixedPointMathLib for uint256;

    // ========================================= STRUCTS =========================================

    /**
     * @param allowWithdraws Whether or not withdrawals are allowed for this asset.
     * @param withdrawDelay The delay in seconds before a requested withdrawal can be completed.
     * @param outstandingShares The total number of shares that are currently outstanding for an asset.
     * @param withdrawFee The fee that is charged when a withdrawal is completed.
     */
    struct WithdrawState {
        bool allowWithdraws;
        uint32 withdrawDelay;
        uint128 outstandingShares;
        uint16 withdrawFee;
    }

    /**
     * @param allowThirdPartyToComplete Whether or not a 3rd party can complete a withdraw on behalf of a user.
     * @param maturity The time at which the withdrawal can be completed.
     * @param shares The number of shares that are requested to be withdrawn.
     * @param exchangeRateAtTimeOfRequest The exchange rate at the time of the request.
     */
    struct WithdrawRequest {
        bool allowThirdPartyToComplete;
        uint40 maturity;
        uint96 shares;
        uint96 exchangeRateAtTimeOfRequest;
    }

    // ========================================= CONSTANTS =========================================

    /**
     * @notice The largest withdraw fee that can be set.
     */
    uint16 internal constant MAX_WITHDRAW_FEE = 0.2e4;

    // ========================================= STATE =========================================

    /**
     * @notice The address that receives the fee when a withdrawal is completed.
     */
    address public feeAddress;

    /**
     * @notice Used to pause calls to `requestWithdraw`, and `completeWithdraw`.
     */
    bool public isPaused;

    /**
     * @notice Whether or not the contract should pull funds from the Boring Vault when completing a withdrawal,
     *         or use funds the BoringVault has previously sent to this contract.
     */
    bool public pullFundsFromVault;

    /**
     * @notice The withdrawal settings for the asset.
     */
    WithdrawState public withdrawState;

    /**
     * @notice The mapping of users to their withdrawal requests.
     */
    mapping(address => WithdrawRequest) public withdrawRequests;

    //============================== ERRORS ===============================

    error DelayedWithdraw__WithdrawFeeTooHigh();
    error DelayedWithdraw__AlreadySetup();
    error DelayedWithdraw__WithdrawsNotAllowed();
    error DelayedWithdraw__WithdrawNotMatured();
    error DelayedWithdraw__NoSharesToWithdraw();
    error DelayedWithdraw__BadAddress();
    error DelayedWithdraw__ThirdPartyCompletionNotAllowed();
    error DelayedWithdraw__Paused();
    error DelayedWithdraw__CallerNotBoringVault();
    error DelayedWithdraw__CannotWithdrawBoringToken();

    //============================== EVENTS ===============================

    event WithdrawRequested(address indexed account, ERC20 indexed asset, uint96 shares, uint40 maturity);
    event WithdrawCancelled(address indexed account, ERC20 indexed asset, uint96 shares);
    event WithdrawCompleted(address indexed account, ERC20 indexed asset, uint256 shares, uint256 assets);
    event FeeAddressSet(address newFeeAddress);
    event SetupWithdrawalsInAsset(address indexed asset, uint64 withdrawDelay, uint16 withdrawFee);
    event WithdrawDelayUpdated(address indexed asset, uint32 newWithdrawDelay);
    event WithdrawFeeUpdated(address indexed asset, uint16 newWithdrawFee);
    event WithdrawalsStopped(address indexed asset);
    event ThirdPartyCompletionChanged(address indexed account, ERC20 indexed asset, bool allowed);
    event Paused();
    event Unpaused();
    event PullFundsFromVaultUpdated(bool _pullFundsFromVault);

    //============================== IMMUTABLES ===============================

    /**
     * @notice The accountant contract that is used to get the exchange rate of assets.
     */
    AccountantWithRateProviders internal immutable accountant;

    /**
     * @notice The teller contract that users are depositing to.
     */
    TellerWithMultiAssetSupport internal immutable teller;

    /**
     * @notice The BoringVault contract that users are withdrawing from.
     */
    BoringVault public immutable boringVault;

    /**
     * @notice The asset that can be withdrawn from the vault.
     */
    ERC20 public immutable asset;

    /**
     * @notice Constant that represents 1 share.
     */
    uint256 internal immutable ONE_SHARE;

    constructor(
        address _primeRBAC,
        address _vault,
        address _accountant,
        address _teller,
        address _payoutAddress
    ) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
        accountant = AccountantWithRateProviders(_accountant);
        teller = TellerWithMultiAssetSupport(_teller);
        boringVault = BoringVault(payable(_vault));
        asset = ERC20(address(boringVault.asset()));
        ONE_SHARE = 10 ** boringVault.decimals();
        if (_payoutAddress == address(0)) revert DelayedWithdraw__BadAddress();
        feeAddress = _payoutAddress;
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Pause this contract, which prevents future calls to `manageVaultWithMerkleVerification`.
     * @dev Callable by MULTISIG_ROLE.
     */
    function pause() external requiresAuth {
        isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause this contract, which allows future calls to `manageVaultWithMerkleVerification`.
     * @dev Callable by MULTISIG_ROLE.
     */
    function unpause() external requiresAuth {
        isPaused = false;
        emit Unpaused();
    }

    /**
     * @notice Stops withdrawals.
     * @dev Callable by MULTISIG_ROLE.
     */
    function stopWithdrawals() external requiresAuth {
        if (!withdrawState.allowWithdraws) revert DelayedWithdraw__WithdrawsNotAllowed();

        withdrawState.allowWithdraws = false;

        emit WithdrawalsStopped(address(asset));
    }

    /**
     * @notice Sets up the withdrawal settings.
     * @dev Callable by OWNER_ROLE.
     */
    function setupWithdraw(uint32 withdrawDelay, uint16 withdrawFee) external onlyProtocolAdmin {
        if (withdrawFee > MAX_WITHDRAW_FEE) revert DelayedWithdraw__WithdrawFeeTooHigh();

        if (withdrawState.allowWithdraws) revert DelayedWithdraw__AlreadySetup();
        withdrawState.allowWithdraws = true;
        withdrawState.withdrawDelay = withdrawDelay;
        withdrawState.withdrawFee = withdrawFee;

        emit SetupWithdrawalsInAsset(address(asset), withdrawDelay, withdrawFee);
    }

    /**
     * @notice Changes the withdraw delay.
     * @dev Callable by MULTISIG_ROLE.
     */
    function changeWithdrawDelay(uint32 withdrawDelay) external requiresAuth {
        if (!withdrawState.allowWithdraws) revert DelayedWithdraw__WithdrawsNotAllowed();

        withdrawState.withdrawDelay = withdrawDelay;

        emit WithdrawDelayUpdated(address(asset), withdrawDelay);
    }

    /**
     * @notice Changes the withdraw fee.
     * @dev Callable by OWNER_ROLE.
     */
    function changeWithdrawFee(uint16 withdrawFee) external requiresAuth {
        if (!withdrawState.allowWithdraws) revert DelayedWithdraw__WithdrawsNotAllowed();

        if (withdrawFee > MAX_WITHDRAW_FEE) revert DelayedWithdraw__WithdrawFeeTooHigh();

        withdrawState.withdrawFee = withdrawFee;

        emit WithdrawFeeUpdated(address(asset), withdrawFee);
    }

    /**
     * @notice Changes the fee address.
     * @dev Callable by STRATEGIST_MULTISIG_ROLE.
     */
    function setFeeAddress(address _feeAddress) external requiresAuth {
        if (_feeAddress == address(0)) revert DelayedWithdraw__BadAddress();
        feeAddress = _feeAddress;

        emit FeeAddressSet(_feeAddress);
    }

    /**
     * @notice Cancels a user's withdrawal request.
     * @dev Callable by MULTISIG_ROLE, and STRATEGIST_MULTISIG_ROLE.
     */
    function cancelUserWithdraw(address user) external requiresAuth {
        _cancelWithdraw(user);
    }

    /**
     * @notice Completes a user's withdrawal request.
     * @dev Admins can complete requests even if they are outside the completion window.
     * @dev Callable by MULTISIG_ROLE, and STRATEGIST_MULTISIG_ROLE.
     */
    function completeUserWithdraw(address user) external requiresAuth returns (uint256 assetsOut) {
        WithdrawRequest storage req = withdrawRequests[user];
        assetsOut = _completeWithdraw(user, req);
    }

    /**
     * @notice Changes the global setting for whether or not to pull funds from the vault when completing a withdrawal.
     * @dev Callable by OWNER_ROLE.
     */
    function setPullFundsFromVault(bool _pullFundsFromVault) external onlyProtocolAdmin {
        pullFundsFromVault = _pullFundsFromVault;

        emit PullFundsFromVaultUpdated(_pullFundsFromVault);
    }

    /**
     * @notice Withdraws a non boring token from the contract.
     * @dev Callable by BoringVault.
     * @dev Eventhough withdrawing the BoringVault share from this contract requires
     *      a malicious leaf in the merkle tree, we explicitly revert if `token`
     *      is the BoringVault.
     * @dev For future reference if this function selector is ever changed, the
     *      associated function selector must be updated in `BaseDecoderAndSanitizer.sol`.
     */
    function withdrawNonBoringToken(ERC20 token, uint256 amount) external {
        if (msg.sender != address(boringVault)) revert DelayedWithdraw__CallerNotBoringVault();
        if (address(token) == address(boringVault)) revert DelayedWithdraw__CannotWithdrawBoringToken();

        if (amount == type(uint256).max) {
            amount = token.balanceOf(address(this));
        }

        token.safeTransfer(address(boringVault), amount);
    }

    // ========================================= PUBLIC FUNCTIONS =========================================

    /**
     * @notice Allows a user to set whether or not a 3rd party can complete withdraws on behalf of them.
     */
    function setAllowThirdPartyToComplete(bool allow) external requiresAuth {
        withdrawRequests[msg.sender].allowThirdPartyToComplete = allow;

        emit ThirdPartyCompletionChanged(msg.sender, asset, allow);
    }

    /**
     * @notice Requests a withdrawal of shares.
     * @dev Publicly callable.
     */
    function requestWithdraw(uint96 shares, bool allowThirdPartyToComplete) external requiresAuth nonReentrant {
        if (isPaused) revert DelayedWithdraw__Paused();
        if (!withdrawState.allowWithdraws) revert DelayedWithdraw__WithdrawsNotAllowed();

        boringVault.safeTransferFrom(msg.sender, address(this), shares);

        withdrawState.outstandingShares += shares;

        WithdrawRequest storage req = withdrawRequests[msg.sender];

        req.shares += shares;
        uint40 maturity = uint40(block.timestamp + withdrawState.withdrawDelay);
        req.maturity = maturity;
        req.exchangeRateAtTimeOfRequest = uint96(accountant.getRateSafe());
        req.allowThirdPartyToComplete = allowThirdPartyToComplete;

        emit WithdrawRequested(msg.sender, asset, shares, maturity);
    }

    /**
     * @notice Cancels msg.sender's withdrawal request.
     * @dev Publicly callable.
     */
    function cancelWithdraw() external requiresAuth nonReentrant {
        _cancelWithdraw(msg.sender);
    }

    /**
     * @notice Completes a user's withdrawal request.
     * @dev Publicly callable. No time limit after maturity.
     */
    function completeWithdraw(address account) external requiresAuth nonReentrant returns (uint256 assetsOut) {
        if (isPaused) revert DelayedWithdraw__Paused();
        WithdrawRequest storage req = withdrawRequests[account];

        if (msg.sender != account && !req.allowThirdPartyToComplete) {
            revert DelayedWithdraw__ThirdPartyCompletionNotAllowed();
        }
        assetsOut = _completeWithdraw(account, req);
    }

    // ========================================= VIEW FUNCTIONS =========================================

    /**
     * @notice Helper function to view the outstanding withdraw debt.
     */
    function viewOutstandingDebt() public view returns (uint256 debt) {
        uint256 rate = accountant.getRateSafe();

        debt = rate.mulDivDown(withdrawState.outstandingShares, ONE_SHARE);
    }

    // ========================================= INTERNAL FUNCTIONS =========================================

    /**
     * @notice Internal helper function that implements shared logic for cancelling a user's withdrawal request.
     */
    function _cancelWithdraw(address account) internal {
        // We do not check if `asset` is allowed, to handle edge cases where the asset is no longer allowed.

        WithdrawRequest storage req = withdrawRequests[account];
        uint96 shares = req.shares;
        if (shares == 0) revert DelayedWithdraw__NoSharesToWithdraw();
        withdrawState.outstandingShares -= shares;
        req.shares = 0;
        boringVault.safeTransfer(account, shares);

        emit WithdrawCancelled(account, asset, shares);
    }

    /**
     * @notice Internal helper function that implements shared logic for completing a user's withdrawal request.
     */
    function _completeWithdraw(address account, WithdrawRequest storage req) internal returns (uint256 assetsOut) {
        if (!withdrawState.allowWithdraws) revert DelayedWithdraw__WithdrawsNotAllowed();

        if (block.timestamp < req.maturity) revert DelayedWithdraw__WithdrawNotMatured();
        if (req.shares == 0) revert DelayedWithdraw__NoSharesToWithdraw();

        uint256 shares = req.shares;

        // Safe to cast shares to a uint128 since req.shares is constrained to be less than 2^96.
        withdrawState.outstandingShares -= uint128(shares);

        if (withdrawState.withdrawFee > 0) {
            // Handle withdraw fee.
            uint256 fee = uint256(shares).mulDivDown(withdrawState.withdrawFee, 1e4);
            shares -= fee;

            // Transfer fee to feeAddress.
            boringVault.safeTransfer(feeAddress, fee);
        }

        // Calculate assets out using exchange rate at time of request (shares are locked and no longer earn rewards)
        assetsOut = shares.mulDivDown(req.exchangeRateAtTimeOfRequest, ONE_SHARE);

        req.shares = 0;

        // if (pullFundsFromVault) {
        //     // Burn shares and transfer assets to user.
        //     boringVault.exit(account, asset, assetsOut, address(this), shares);
        // } else {
        //     // Burn shares.
        //     boringVault.exit(account, asset, 0, address(this), shares);
        //     // Transfer assets to user.
        //     asset.safeTransfer(account, assetsOut);
        // }
        teller.bulkWithdraw(shares, assetsOut, account);

        emit WithdrawCompleted(account, asset, shares, assetsOut);
    }

    //=========================================  VIEW FUNCTIONS =========================================

    function getWithdrawState() external view returns (WithdrawState memory) {
        return withdrawState;
    }
}
