// SPDX-License-Identifier: SEL-1.0
// Copyright © 2025 Veda Tech Labs
// Derived from Boring Vault Software © 2025 Veda Tech Labs (TEST ONLY – NO COMMERCIAL USE)
// Licensed under Software Evaluation License, Version 1.0
pragma solidity ^0.8.30;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {WETH} from "solmate/src/tokens/WETH.sol";
import {BoringVault} from "./BoringVault.sol";
import {AccountantWithRateProviders} from "./AccountantWithRateProviders.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {BeforeTransferHook} from "../interfaces/hooks/BeforeTransferHook.sol";
import {Auth, Authority} from "solmate/src/auth/Auth.sol";
import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";
import {IPausable} from "../interfaces/IPausable.sol";

contract TellerWithMultiAssetSupport is Auth, BeforeTransferHook, ReentrancyGuard, IPausable {
    using FixedPointMathLib for uint256;
    using SafeTransferLib for ERC20;
    using SafeTransferLib for WETH;

    // ========================================= STRUCTS =========================================

    /**
     * @param denyFrom bool indicating whether or not the user is on the deny from list.
     * @param denyTo bool indicating whether or not the user is on the deny to list.
     * @param denyOperator bool indicating whether or not the user is on the deny operator list.
     * @param permissionedOperator bool indicating whether or not the user is a permissioned operator, only applies when permissionedTransfers is true.
     * @param shareUnlockTime uint256 indicating the time at which the shares will be unlocked.
     */
    struct BeforeTransferData {
        bool denyFrom;
        bool denyTo;
        bool denyOperator;
        bool permissionedOperator;
        uint256 shareUnlockTime;
    }

    // ========================================= CONSTANTS =========================================

    /**
     * @notice Native address used to tell the contract to handle native asset deposits.
     */
    address internal constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /**
     * @notice The maximum possible share lock period.
     */
    uint256 internal constant MAX_SHARE_LOCK_PERIOD = 3 days;

    // ========================================= STATE =========================================

    /**
     * @notice The single asset this teller supports
     */
    ERC20 public immutable asset;

    /**
     * @notice Whether deposits are allowed for the asset
     */
    bool public allowDeposits;

    /**
     * @notice Whether withdrawals are allowed for the asset
     */
    bool public allowWithdraws;

    /**
     * @notice After deposits, shares are locked to the msg.sender's address
     *         for `shareLockPeriod`.
     * @dev During this time all transfers from msg.sender will revert.
     */
    uint64 public shareLockPeriod;

    /**
     * @notice Used to pause calls to `deposit` and `depositWithPermit`.
     */
    bool public isPaused;

    /**
     * @notice If true, only permissioned operators can transfer shares.
     */
    bool public permissionedTransfers;

    /**
     * @notice The global deposit cap of the vault.
     * @dev If the cap is reached, no new deposits are accepted. No partial fills.
     */
    uint112 public depositCap = type(uint112).max;

    /**
     * @notice Maps address to BeforeTransferData struct to check if shares are locked and if the address is on any allow or deny list.
     */
    mapping(address => BeforeTransferData) public beforeTransferData;

    //============================== ERRORS ===============================

    error TellerWithMultiAssetSupport__ShareLockPeriodTooLong();
    error TellerWithMultiAssetSupport__SharesAreLocked();
    error TellerWithMultiAssetSupport__ZeroAssets();
    error TellerWithMultiAssetSupport__MinimumMintNotMet();
    error TellerWithMultiAssetSupport__MinimumAssetsNotMet();
    error TellerWithMultiAssetSupport__PermitFailedAndAllowanceTooLow();
    error TellerWithMultiAssetSupport__ZeroShares();
    error TellerWithMultiAssetSupport__DualDeposit();
    error TellerWithMultiAssetSupport__Paused();
    error TellerWithMultiAssetSupport__TransferDenied(address from, address to, address operator);
    error TellerWithMultiAssetSupport__CannotDepositNative();
    error TellerWithMultiAssetSupport__DepositExceedsCap();
    error TellerWithMultiAssetSupport__DepositsNotAllowed();
    error TellerWithMultiAssetSupport__WithdrawsNotAllowed();

    //============================== EVENTS ===============================

    event Paused();
    event Unpaused();
    event DepositsAllowed(bool allowed);
    event WithdrawsAllowed(bool allowed);
    event Deposit(
        uint256 nonce,
        address indexed receiver,
        address indexed depositAsset,
        uint256 depositAmount,
        uint256 shareAmount,
        uint256 depositTimestamp,
        uint256 shareLockPeriodAtTimeOfDeposit,
        address indexed referralAddress
    );
    event BulkDeposit(address indexed asset, uint256 depositAmount);
    event BulkWithdraw(address indexed asset, uint256 shareAmount);
    event Withdraw(address indexed asset, uint256 shareAmount);
    event DenyFrom(address indexed user);
    event DenyTo(address indexed user);
    event DenyOperator(address indexed user);
    event AllowFrom(address indexed user);
    event AllowTo(address indexed user);
    event AllowOperator(address indexed user);
    event PermissionedTransfersSet(bool permissionedTransfers);
    event AllowPermissionedOperator(address indexed operator);
    event DenyPermissionedOperator(address indexed operator);
    event DepositCapSet(uint112 cap);

    // =============================== MODIFIERS ===============================

    /**
     * @notice Reverts if the deposit asset is the native asset.
     */
    modifier revertOnNativeDeposit(address depositAsset) {
        if (depositAsset == NATIVE) revert TellerWithMultiAssetSupport__CannotDepositNative();
        _;
    }

    //============================== IMMUTABLES ===============================

    /**
     * @notice The BoringVault this contract is working with.
     */
    BoringVault public immutable vault;

    /**
     * @notice The AccountantWithRateProviders this contract is working with.
     */
    AccountantWithRateProviders public immutable accountant;

    /**
     * @notice One share of the BoringVault.
     */
    uint256 internal immutable ONE_SHARE;

    /**
     * @notice The native wrapper contract.
     */
    WETH public immutable nativeWrapper;

    constructor(
        address _owner,
        address _vault,
        address _accountant,
        address _asset,
        address _weth
    ) Auth(_owner, Authority(address(0))) {
        vault = BoringVault(payable(_vault));
        ONE_SHARE = 10 ** vault.decimals();
        accountant = AccountantWithRateProviders(_accountant);
        asset = ERC20(_asset);
        nativeWrapper = WETH(payable(_weth));
        permissionedTransfers = false;
        allowDeposits = true;
        allowWithdraws = true;
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Pause this contract, which prevents future calls to `deposit` and `depositWithPermit`.
     * @dev Callable by MULTISIG_ROLE.
     */
    function pause() external requiresAuth {
        isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause this contract, which allows future calls to `deposit` and `depositWithPermit`.
     * @dev Callable by MULTISIG_ROLE.
     */
    function unpause() external requiresAuth {
        isPaused = false;
        emit Unpaused();
    }

    /**
     * @notice Enable or disable deposits for the asset.
     * @dev Callable by OWNER_ROLE.
     */
    function setAllowDeposits(bool _allowDeposits) external requiresAuth {
        allowDeposits = _allowDeposits;
        emit DepositsAllowed(_allowDeposits);
    }

    /**
     * @notice Enable or disable withdrawals for the asset.
     * @dev Callable by OWNER_ROLE.
     */
    function setAllowWithdraws(bool _allowWithdraws) external requiresAuth {
        allowWithdraws = _allowWithdraws;
        emit WithdrawsAllowed(_allowWithdraws);
    }

    /**
     * @notice Sets the share lock period.
     * @dev This locks shares to the user address for the specified period.
     * @dev Callable by OWNER_ROLE.
     */
    function setShareLockPeriod(uint64 _shareLockPeriod) external requiresAuth {
        if (_shareLockPeriod > MAX_SHARE_LOCK_PERIOD) revert TellerWithMultiAssetSupport__ShareLockPeriodTooLong();
        shareLockPeriod = _shareLockPeriod;
    }

    /**
     * @notice Deny a user from transferring or receiving shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyAll(address user) external requiresAuth {
        beforeTransferData[user].denyFrom = true;
        beforeTransferData[user].denyTo = true;
        beforeTransferData[user].denyOperator = true;
        emit DenyFrom(user);
        emit DenyTo(user);
        emit DenyOperator(user);
    }

    /**
     * @notice Allow a user to transfer or receive shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowAll(address user) external requiresAuth {
        beforeTransferData[user].denyFrom = false;
        beforeTransferData[user].denyTo = false;
        beforeTransferData[user].denyOperator = false;
        emit AllowFrom(user);
        emit AllowTo(user);
        emit AllowOperator(user);
    }

    /**
     * @notice Deny a user from transferring shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyFrom(address user) external requiresAuth {
        beforeTransferData[user].denyFrom = true;
        emit DenyFrom(user);
    }

    /**
     * @notice Allow a user to transfer shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowFrom(address user) external requiresAuth {
        beforeTransferData[user].denyFrom = false;
        emit AllowFrom(user);
    }

    /**
     * @notice Deny a user from receiving shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyTo(address user) external requiresAuth {
        beforeTransferData[user].denyTo = true;
        emit DenyTo(user);
    }

    /**
     * @notice Allow a user to receive shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowTo(address user) external requiresAuth {
        beforeTransferData[user].denyTo = false;
        emit AllowTo(user);
    }

    /**
     * @notice Deny an operator from transferring shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function denyOperator(address user) external requiresAuth {
        beforeTransferData[user].denyOperator = true;
        emit DenyOperator(user);
    }

    /**
     * @notice Allow an operator to transfer shares.
     * @dev Callable by OWNER_ROLE, and DENIER_ROLE.
     */
    function allowOperator(address user) external requiresAuth {
        beforeTransferData[user].denyOperator = false;
        emit AllowOperator(user);
    }

    /**
     * @notice Set the permissioned transfers flag.
     * @dev Callable by OWNER_ROLE.
     */
    function setPermissionedTransfers(bool _permissionedTransfers) external requiresAuth {
        permissionedTransfers = _permissionedTransfers;
        emit PermissionedTransfersSet(_permissionedTransfers);
    }

    /**
     * @notice Give permission to an operator to transfer shares when permissioned transfers flag is true.
     * @dev Callable by OWNER_ROLE.
     */
    function allowPermissionedOperator(address operator) external requiresAuth {
        beforeTransferData[operator].permissionedOperator = true;
        emit AllowPermissionedOperator(operator);
    }

    /**
     * @notice Revoke permission from an operator to transfer shares when permissioned transfers flag is true.
     * @dev Callable by OWNER_ROLE, and DENIER_.
     */
    function denyPermissionedOperator(address operator) external requiresAuth {
        beforeTransferData[operator].permissionedOperator = false;
        emit DenyPermissionedOperator(operator);
    }

    /**
     * @notice Set the deposit cap of the vault.
     * @dev Callable by OWNER_ROLE
     */
    function setDepositCap(uint112 cap) external requiresAuth {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    // ========================================= BeforeTransferHook FUNCTIONS =========================================

    /**
     * @notice Implement beforeTransfer hook to check if shares are locked, or if `from`, `to`, or `operator` are denied in beforeTransferData.
     * @notice If permissionedTransfers is true, then only operators on the allow list can transfer shares.
     * @notice If share lock period is set to zero, then users will be able to mint and transfer in the same tx.
     *         if this behavior is not desired then a share lock period of >=1 should be used.
     */
    function beforeTransfer(address from, address to, address operator) public view virtual {
        _handleDenyList(from, to, operator);

        if (permissionedTransfers && !beforeTransferData[operator].permissionedOperator) {
            revert TellerWithMultiAssetSupport__TransferDenied(from, to, operator);
        }

        if (beforeTransferData[from].shareUnlockTime > block.timestamp) {
            revert TellerWithMultiAssetSupport__SharesAreLocked();
        }
    }

    /**
     * @notice Implement legacy beforeTransfer hook to check if shares are locked, or if `from`is on the deny list.
     */
    function beforeTransfer(address from) public view virtual {
        if (beforeTransferData[from].denyFrom) {
            revert TellerWithMultiAssetSupport__TransferDenied(from, address(0), address(0));
        }
        if (beforeTransferData[from].shareUnlockTime > block.timestamp) {
            revert TellerWithMultiAssetSupport__SharesAreLocked();
        }
    }

    /**
     * @notice Internal function to check deny lists for transfers.
     * @dev Reverts if `from` is denied, `to` is denied, or `operator` is denied.
     * @param from The sender address.
     * @param to The receiver address.
     * @param operator The address performing the operation.
     */
    function _handleDenyList(address from, address to, address operator) internal view {
        if (
            beforeTransferData[from].denyFrom ||
            beforeTransferData[to].denyTo ||
            beforeTransferData[operator].denyOperator
        ) {
            revert TellerWithMultiAssetSupport__TransferDenied(from, to, operator);
        }
    }

    // ========================================= USER FUNCTIONS =========================================

    /**
     * @notice Allows users to deposit into the BoringVault, if this contract is not paused.
     * @dev Publicly callable.
     */
    function deposit(
        uint256 depositAmount,
        uint256 minimumMint,
        address referralAddress
    ) external payable virtual requiresAuth nonReentrant returns (uint256 shares) {
        _beforeDeposit();

        ERC20 depositAsset = asset;
        address from;
        if (address(asset) == address(nativeWrapper) && msg.value > 0) {
            if (msg.value == 0) revert TellerWithMultiAssetSupport__ZeroAssets();
            nativeWrapper.deposit{value: msg.value}();
            // Set depositAmount to msg.value.
            depositAmount = msg.value;
            nativeWrapper.safeApprove(address(vault), depositAmount);
            // Set from to this address since user transferred value.
            from = address(this);
        } else {
            if (msg.value > 0) revert TellerWithMultiAssetSupport__DualDeposit();
            from = msg.sender;
        }

        shares = _erc20Deposit(depositAsset, depositAmount, minimumMint, from, msg.sender);
        _afterPublicDeposit(msg.sender, depositAsset, depositAmount, shares, shareLockPeriod, referralAddress);
    }

    /**
     * @notice Allows users to deposit into BoringVault using permit.
     * @dev Publicly callable.
     */
    function depositWithPermit(
        uint256 depositAmount,
        uint256 minimumMint,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address referralAddress
    ) external virtual requiresAuth nonReentrant returns (uint256 shares) {
        _beforeDeposit();

        _handlePermit(asset, depositAmount, deadline, v, r, s);

        shares = _erc20Deposit(asset, depositAmount, minimumMint, msg.sender, msg.sender);
        _afterPublicDeposit(msg.sender, asset, depositAmount, shares, shareLockPeriod, referralAddress);
    }

    /**
     * @notice Allows on ramp role to deposit into this contract.
     * @dev Does NOT support native deposits.
     * @dev Callable by SOLVER_ROLE.
     */
    function bulkDeposit(
        uint256 depositAmount,
        uint256 minimumMint,
        address to
    ) external virtual requiresAuth nonReentrant returns (uint256 shares) {
        _beforeDeposit();

        shares = _erc20Deposit(asset, depositAmount, minimumMint, msg.sender, to);
        emit BulkDeposit(address(asset), depositAmount);
    }

    /**
     * @notice Allows off ramp role to withdraw from this contract.
     * @dev Callable by SOLVER_ROLE.
     */
    function bulkWithdraw(
        uint256 shareAmount,
        uint256 minimumAssets,
        address to
    ) external virtual requiresAuth nonReentrant returns (uint256 assetsOut) {
        assetsOut = _withdraw(shareAmount, minimumAssets, to);
        emit BulkWithdraw(address(asset), shareAmount);
    }

    /**
     * @notice Allows withdrawals from this contract.
     * @dev Either public or disabled depending on configuration.
     */
    function withdraw(
        uint256 shareAmount,
        uint256 minimumAssets,
        address to
    ) external virtual requiresAuth nonReentrant returns (uint256 assetsOut) {
        beforeTransfer(msg.sender, address(0), msg.sender);
        assetsOut = _withdraw(shareAmount, minimumAssets, to);
        emit Withdraw(address(asset), shareAmount);
    }

    // ========================================= INTERNAL HELPER FUNCTIONS =========================================

    /**
     * @notice Implements a common ERC20 deposit into BoringVault.
     */
    function _erc20Deposit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 minimumMint,
        address from,
        address to
    ) internal virtual returns (uint256 shares) {
        _handleDenyList(from, to, msg.sender);
        uint112 cap = depositCap;
        if (depositAmount == 0) revert TellerWithMultiAssetSupport__ZeroAssets();
        shares = depositAmount.mulDivDown(ONE_SHARE, accountant.getRate());
        if (shares < minimumMint) revert TellerWithMultiAssetSupport__MinimumMintNotMet();
        if (cap != type(uint112).max) {
            if (shares + vault.totalSupply() > cap) revert TellerWithMultiAssetSupport__DepositExceedsCap();
        }
        vault.enter(from, depositAsset, depositAmount, to, shares);
    }

    /**
     * @notice Implements a common ERC20 withdraw from BoringVault.
     */
    function _withdraw(
        uint256 shareAmount,
        uint256 minimumAssets,
        address to
    ) internal virtual returns (uint256 assetsOut) {
        if (isPaused) revert TellerWithMultiAssetSupport__Paused();
        if (!allowWithdraws) revert TellerWithMultiAssetSupport__WithdrawsNotAllowed();

        if (shareAmount == 0) revert TellerWithMultiAssetSupport__ZeroShares();
        assetsOut = shareAmount.mulDivDown(accountant.getRate(), ONE_SHARE);
        if (assetsOut < minimumAssets) revert TellerWithMultiAssetSupport__MinimumAssetsNotMet();
        vault.exit(to, asset, assetsOut, msg.sender, shareAmount);
    }

    /**
     * @notice Handle pre-deposit checks.
     */
    function _beforeDeposit() internal view {
        if (isPaused) revert TellerWithMultiAssetSupport__Paused();
        if (!allowDeposits) revert TellerWithMultiAssetSupport__DepositsNotAllowed();
    }

    /**
     * @notice Handle share lock logic, and event.
     */
    function _afterPublicDeposit(
        address user,
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 shares,
        uint256 currentShareLockPeriod,
        address referralAddress
    ) internal {
        // Only set share unlock time if share lock period is greater than 0.
        if (currentShareLockPeriod > 0) {
            beforeTransferData[user].shareUnlockTime = block.timestamp + currentShareLockPeriod;
        }
        emit Deposit(
            0, // nonce no longer used
            user,
            address(depositAsset),
            depositAmount,
            shares,
            block.timestamp,
            currentShareLockPeriod,
            referralAddress
        );
    }

    /**
     * @notice Handle permit logic.
     */
    function _handlePermit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        try depositAsset.permit(msg.sender, address(vault), depositAmount, deadline, v, r, s) {} catch {
            if (depositAsset.allowance(msg.sender, address(vault)) < depositAmount) {
                revert TellerWithMultiAssetSupport__PermitFailedAndAllowanceTooLow();
            }
        }
    }

    /**
     * @notice Hook that is called after a deposit operation.
     * @dev Can be overridden by child contracts to implement custom post-deposit logic.
     * @param assetAmount The amount of the asset that was deposited.
     */
    function _afterDeposit(uint256 assetAmount) internal virtual {}

    /**
     * @notice Hook that is called before a withdrawal operation.
     * @dev Can be overridden by child contracts to implement custom pre-withdrawal logic.
     * @param assetAmount The amount of the asset that will be withdrawn.
     */
    function _beforeWithdraw(uint256 assetAmount) internal virtual {}

    // ========================================= VIEW FUNCTIONS =========================================

    /**
     * @notice Returns the version of the contract.
     */
    function version() public pure virtual returns (string memory) {
        return "Base V0.1";
    }
}
