// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {BoringVault} from "./BoringVault.sol";
import {AccountantProviders} from "./AccountantProviders.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {IBeforeUpdateHook} from "../interfaces/hooks/IBeforeUpdateHook.sol";
import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";
import {Distributor} from "./Distributor.sol";
import {ITeller} from "../interfaces/ITeller.sol";

import "../auth/PrimeAuth.sol";

contract Teller is PrimeAuth, IBeforeUpdateHook, ReentrancyGuard, ITeller {
    using FixedPointMathLib for uint256;
    using SafeTransferLib for ERC20;

    // ========================================= STRUCTS =========================================

    /**
     * @param allowDeposits whether deposits are allowed for the asset
     * @param allowWithdraws whether withdrawals are allowed for the asset
     * @param shareLockPeriod after deposits, shares are locked to the msg.sender's address for this period
     * @param depositCap the global deposit cap of the vault (in shares)
     */
    struct TellerState {
        bool allowDeposits;
        bool allowWithdraws;
        uint64 shareLockPeriod;
        uint112 depositCap;
    }

    /**
     * @param shareUnlockTime uint256 indicating the time at which the shares will be unlocked.
     */
    struct BeforeTransferData {
        uint256 shareUnlockTime;
    }

    // ========================================= CONSTANTS =========================================

    /**
     * @notice The maximum possible share lock period.
     */
    uint256 internal constant MAX_SHARE_LOCK_PERIOD = 7 days;

    // ========================================= STATE =========================================

    /**
     * @notice Store the teller state in a packed slot.
     */
    TellerState public tellerState;

    /**
     * @notice Maps address to BeforeTransferData struct to check if shares are locked and if the address is on any allow or deny list.
     */
    mapping(address => BeforeTransferData) public beforeTransferData;

    //============================== IMMUTABLES ===============================
    /**
     * @notice The single asset this teller supports
     */
    ERC20 public immutable asset;

    /**
     * @notice The BoringVault this contract is working with.
     */
    BoringVault public immutable vault;

    /**
     * @notice The AccountantProviders this contract is working with.
     */
    AccountantProviders public immutable accountant;

    /**
     * @notice The Distributor contract for reward distribution (optional).
     */
    Distributor public distributor;

    /**
     * @notice One share of the BoringVault.
     */
    uint256 internal immutable ONE_SHARE;

    constructor(address _primeRBAC, address _vault, address _accountant) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
        vault = BoringVault(payable(_vault));
        ONE_SHARE = 10 ** vault.decimals();
        accountant = AccountantProviders(_accountant);
        asset = vault.asset();
        tellerState = TellerState({allowDeposits: true, allowWithdraws: true, shareLockPeriod: 0, depositCap: type(uint112).max});
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Enable or disable deposits for the asset.
     * @dev Callable by OWNER_ROLE.
     */
    function setAllowDeposits(bool _allowDeposits) external onlyProtocolAdmin {
        tellerState.allowDeposits = _allowDeposits;
        emit DepositsAllowed(_allowDeposits);
    }

    /**
     * @notice Enable or disable withdrawals for the asset.
     * @dev Callable by OWNER_ROLE.
     */
    function setAllowWithdraws(bool _allowWithdraws) external onlyProtocolAdmin {
        tellerState.allowWithdraws = _allowWithdraws;
        emit WithdrawsAllowed(_allowWithdraws);
    }

    /**
     * @notice Set the Distributor contract for reward distribution.
     * @dev Callable by OWNER_ROLE.
     */
    function setDistributor(address _distributor) external onlyProtocolAdmin {
        distributor = Distributor(_distributor);
    }

    /**
     * @notice Sets the share lock period.
     * @dev This locks shares to the user address for the specified period.
     * @dev Callable by PROTOCOL_ADMIN_ROLE.
     */
    function setShareLockPeriod(uint64 _shareLockPeriod) external onlyProtocolAdmin {
        if (_shareLockPeriod > MAX_SHARE_LOCK_PERIOD) revert Teller__ShareLockPeriodTooLong();
        tellerState.shareLockPeriod = _shareLockPeriod;
    }

    /**
     * @notice Set the deposit cap of the vault.
     * @dev Callable by PROTOCOL_ADMIN_ROLE
     */
    function setDepositCap(uint112 cap) external onlyProtocolAdmin {
        tellerState.depositCap = cap;
        emit DepositCapSet(cap);
    }

    // ========================================= IBeforeUpdateHook FUNCTIONS =========================================

    /**
     * @notice Implement beforeUpdate hook to check if shares are locked.
     * @notice If share lock period is set to zero, then users will be able to mint and transfer in the same tx.
     *         if this behavior is not desired then a share lock period of >=1 should be used.
     * @notice When minting (from = address(0)), only checks `to`.
     * @notice When burning (to = address(0)), only checks `from`.
     */
    function beforeUpdate(address from, address to, uint256 /* amount */, address /* operator */) public virtual {
        _getAccountant().updateExchangeRate();
        // Update rewards BEFORE balance changes if distributor is set
        if (address(distributor) != address(0)) {
            if (from != address(0)) {
                distributor.updateRewardForAccount(from);
            }
            if (to != address(0)) {
                distributor.updateRewardForAccount(to);
            }
        }

        // For transfers (not mint/burn): check if shares are locked
        if (from != address(0) && beforeTransferData[from].shareUnlockTime > block.timestamp) {
            revert Teller__SharesAreLocked();
        }
    }

    // ========================================= USER FUNCTIONS =========================================

    /**
     * @notice Allows users to deposit into the BoringVault, if this contract is not paused.
     * @dev Publicly callable.
     */
    function deposit(uint256 depositAmount, uint256 minimumMint) external virtual requiresAuth nonReentrant returns (uint256 shares) {
        _beforeDeposit();
        shares = _erc20Deposit(depositAmount, minimumMint, msg.sender, msg.sender);
        _afterPublicDeposit(msg.sender, depositAmount, shares, tellerState.shareLockPeriod);
    }

    /**
     * @notice Allows on ramp role to deposit into this contract.
     * @dev Does NOT support native deposits.
     * @dev Callable by SOLVER_ROLE.
     */
    function bulkDeposit(uint256 depositAmount, uint256 minimumMint, address to) external virtual requiresAuth nonReentrant returns (uint256 shares) {
        _beforeDeposit();
        shares = _erc20Deposit(depositAmount, minimumMint, msg.sender, to);
        emit BulkDeposit(address(asset), depositAmount);
    }

    /**
     * @notice Allows withdrawals from this contract.
     * @dev Either public or disabled depending on configuration.
     */
    function withdraw(uint256 shareAmount, uint256 minimumAssets, address to) external virtual requiresAuth nonReentrant returns (uint256 assetsOut) {
        _getAccountant().updateExchangeRate();
        assetsOut = _withdraw(shareAmount, minimumAssets, to);
        emit Withdraw(address(asset), shareAmount);
    }

    // ========================================= INTERNAL HELPER FUNCTIONS =========================================

    /**
     * @notice Implements a common ERC20 deposit into BoringVault.
     */
    function _erc20Deposit(uint256 depositAmount, uint256 minimumMint, address from, address to) internal virtual returns (uint256 shares) {
        _getAccountant().updateExchangeRate();
        TellerState storage state = tellerState;
        if (depositAmount == 0) revert Teller__ZeroAssets();
        shares = depositAmount.mulDivDown(ONE_SHARE, accountant.getRate());
        if (shares < minimumMint) revert Teller__MinimumMintNotMet();
        if (state.depositCap != type(uint112).max) {
            uint256 totalSharesAfterDeposit = shares + vault.totalSupply();
            if (totalSharesAfterDeposit > state.depositCap) revert Teller__DepositExceedsCap(totalSharesAfterDeposit, state.depositCap);
        }
        vault.enter(from, depositAmount, to, shares);
        _afterDeposit(depositAmount);
    }

    /**
     * @notice Implements a common ERC20 withdraw from BoringVault.
     */
    function _withdraw(uint256 shareAmount, uint256 minimumAssets, address to) internal virtual returns (uint256 assetsOut) {
        TellerState storage state = tellerState;
        if (isPaused) revert Teller__Paused();
        if (!state.allowWithdraws) revert Teller__WithdrawsNotAllowed();

        if (shareAmount == 0) revert Teller__ZeroShares();
        assetsOut = shareAmount.mulDivDown(accountant.getRate(), ONE_SHARE);
        if (assetsOut < minimumAssets) revert Teller__MinimumAssetsNotMet();
        _beforeWithdraw(assetsOut);
        vault.exit(to, assetsOut, msg.sender, shareAmount);
    }

    /**
     * @notice Helper function to cast from base accountant type to yield streaming accountant
     */
    function _getAccountant() internal view returns (AccountantProviders) {
        return AccountantProviders(address(accountant));
    }

    /**
     * @notice Handle pre-deposit checks.
     */
    function _beforeDeposit() internal view {
        TellerState storage state = tellerState;
        if (isPaused) revert Teller__Paused();
        if (!state.allowDeposits) revert Teller__DepositsNotAllowed();
    }

    /**
     * @notice Handle share lock logic, and event.
     */
    function _afterPublicDeposit(address user, uint256 depositAmount, uint256 shares, uint256 currentShareLockPeriod) internal {
        // Only set share unlock time if share lock period is greater than 0.
        if (currentShareLockPeriod > 0) {
            beforeTransferData[user].shareUnlockTime = block.timestamp + currentShareLockPeriod;
        }
        emit Deposit(
            0, // nonce no longer used
            user,
            depositAmount,
            shares,
            block.timestamp,
            currentShareLockPeriod
        );
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

    /**
     * @notice Get the current teller state.
     */
    function getTellerState() external view returns (TellerState memory) {
        return tellerState;
    }
}
