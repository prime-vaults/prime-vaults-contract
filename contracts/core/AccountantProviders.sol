// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {BoringVault} from "./BoringVault.sol";
import {IPausable} from "../interfaces/IPausable.sol";
import {IAccountantErrors} from "../interfaces/IAccountantErrors.sol";
import {IAccountantEvents} from "../interfaces/IAccountantEvents.sol";

import {PrimeAuth} from "../auth/PrimeAuth.sol";

contract AccountantProviders is PrimeAuth, IPausable, IAccountantErrors, IAccountantEvents {
    using FixedPointMathLib for uint256;
    using SafeTransferLib for ERC20;

    // ========================================= STRUCTS =========================================

    /**
     * @param payoutAddress the address `claimFees` sends fees to
     * @param feesOwedInBase total pending fees owed in terms of base
     * @param totalSharesLastUpdate total amount of shares the last exchange rate update
     * @param exchangeRate the current exchange rate in terms of base
     * @param lastUpdateTimestamp the block timestamp of the last exchange rate update
     * @param isPaused whether or not this contract is paused
     * @param platformFee the platform fee
     */
    struct AccountantState {
        address payoutAddress;
        uint128 feesOwedInBase;
        uint128 totalSharesLastUpdate;
        uint96 exchangeRate;
        uint64 lastUpdateTimestamp;
        bool isPaused;
        uint16 platformFee;
    }

    // ========================================= STATE =========================================

    /**
     * @notice Store the accountant state in 3 packed slots.
     */
    AccountantState public accountantState;

    //============================== IMMUTABLES ===============================

    /**
     * @notice The base asset rates are provided in.
     */
    ERC20 public immutable base;

    /**
     * @notice The decimals rates are provided in.
     */
    uint8 public immutable decimals;

    /**
     * @notice The BoringVault this accountant is working with.
     *         Used to determine share supply for fee calculation.
     */
    BoringVault public immutable vault;

    /**
     * @notice One share of the BoringVault.
     */
    uint256 internal immutable ONE_SHARE;

    constructor(
        address _primeRBAC,
        address _vault,
        address _payoutAddress,
        uint16 platformFee
    ) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
        vault = BoringVault(payable(_vault));
        base = vault.asset();
        decimals = base.decimals();
        ONE_SHARE = 10 ** vault.decimals();
        accountantState = AccountantState({
            payoutAddress: _payoutAddress,
            feesOwedInBase: 0,
            totalSharesLastUpdate: uint128(vault.totalSupply()),
            exchangeRate: uint96(10 ** decimals),
            lastUpdateTimestamp: uint64(block.timestamp),
            isPaused: false,
            platformFee: platformFee
        });
    }

    // ========================================= ADMIN FUNCTIONS =========================================
    /**
     * @notice Pause this contract, which prevents future calls to `updateExchangeRate`, and any safe rate
     *         calls will revert.
     * @dev Callable by MULTISIG_ROLE.
     */
    function pause() external onlyEmergencyAdmin {
        accountantState.isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause this contract, which allows future calls to `updateExchangeRate`, and any safe rate
     *         calls will stop reverting.
     * @dev Callable by MULTISIG_ROLE.
     */
    function unpause() external onlyEmergencyAdmin {
        accountantState.isPaused = false;
        emit Unpaused();
    }

    /**
     * @notice Update the platform fee to a new value.
     * @dev Callable by OWNER_ROLE.
     */
    function updatePlatformFee(uint16 platformFee) external onlyProtocolAdmin {
        if (platformFee > 0.2e4) revert AccountantProviders__PlatformFeeTooLarge();
        uint16 oldFee = accountantState.platformFee;
        accountantState.platformFee = platformFee;
        emit PlatformFeeUpdated(oldFee, platformFee);
    }

    /**
     * @notice Update the payout address fees are sent to.
     * @dev Callable by OWNER_ROLE.
     */
    function updatePayoutAddress(address payoutAddress) external onlyProtocolAdmin {
        address oldPayout = accountantState.payoutAddress;
        accountantState.payoutAddress = payoutAddress;
        emit PayoutAddressUpdated(oldPayout, payoutAddress);
    }

    // ========================================= UPDATE EXCHANGE RATE/FEES FUNCTIONS =========================================

    /**
     * @notice Updates this contract to calculate fees and adjust exchange rate.
     * @dev Calculates platform fees and reduces exchange rate to reflect fees owed.
     * @dev Callable by UPDATE_EXCHANGE_RATE_ROLE.
     */
    function updateExchangeRate() public virtual requiresAuth {
        AccountantState storage state = accountantState;
        if (state.isPaused) revert AccountantProviders__Paused();

        uint64 currentTime = uint64(block.timestamp);
        uint96 oldExchangeRate = state.exchangeRate;
        uint256 currentShares = vault.totalSupply();

        // Calculate platform fees
        uint256 newFeesOwedInBase = _calculatePlatformFee(
            state.totalSharesLastUpdate,
            state.lastUpdateTimestamp,
            state.platformFee,
            oldExchangeRate,
            currentShares,
            currentTime
        );
        state.feesOwedInBase += uint128(newFeesOwedInBase);

        // Update exchange rate to reflect fees owed
        // newRate = (totalAssets - feesOwed) / totalShares
        if (currentShares > 0) {
            uint256 totalAssets = currentShares.mulDivDown(oldExchangeRate, ONE_SHARE);
            uint256 assetsAfterFees = totalAssets > state.feesOwedInBase ? totalAssets - state.feesOwedInBase : 0;
            state.exchangeRate = uint96(assetsAfterFees.mulDivDown(ONE_SHARE, currentShares));
        }
        state.lastUpdateTimestamp = currentTime;
        state.totalSharesLastUpdate = uint128(currentShares);

        emit ExchangeRateUpdated(oldExchangeRate, state.exchangeRate, currentTime);
    }

    /**
     * @notice Claim pending fees.
     * @dev This function must be called by the BoringVault.
     * @dev Automatically calls updateExchangeRate() to ensure fees are up to date.
     * @dev Fees are always paid in base asset.
     */
    function claimFees() external {
        if (msg.sender != address(vault)) revert AccountantProviders__OnlyCallableByBoringVault();

        AccountantState storage state = accountantState;
        if (state.isPaused) revert AccountantProviders__Paused();

        this.updateExchangeRate();
        if (state.feesOwedInBase == 0) revert AccountantProviders__ZeroFeesOwed();

        uint256 feesOwed = state.feesOwedInBase;

        // Zero out fees owed.
        state.feesOwedInBase = 0;

        // Transfer base asset to payout address.
        base.safeTransferFrom(msg.sender, state.payoutAddress, feesOwed);

        emit FeesClaimed(address(base), feesOwed);
    }

    // ========================================= VIEW FUNCTIONS =========================================

    /**
     * @notice Get this BoringVault's current rate in the base.
     */
    function getRate() public view virtual returns (uint256 rate) {
        rate = accountantState.exchangeRate;
    }

    /**
     * @notice Get this BoringVault's current rate in the base.
     * @dev Revert if paused.
     */
    function getRateSafe() external view virtual returns (uint256 rate) {
        if (accountantState.isPaused) revert AccountantProviders__Paused();
        rate = getRate();
    }

    // ========================================= INTERNAL HELPER FUNCTIONS =========================================

    /**
     * @notice Calculate platform fees.
     */
    function _calculatePlatformFee(
        uint128 totalSharesLastUpdate,
        uint64 lastUpdateTimestamp,
        uint16 platformFee,
        uint256 currentExchangeRate,
        uint256 currentTotalShares,
        uint64 currentTime
    ) internal view returns (uint256 platformFeesOwedInBase) {
        uint256 shareSupplyToUse = currentTotalShares;
        // Use the maximum between current total supply and total supply for last update.
        if (totalSharesLastUpdate > shareSupplyToUse) {
            shareSupplyToUse = totalSharesLastUpdate;
        }

        // Determine platform fees owned.
        if (platformFee > 0) {
            uint256 timeDelta = currentTime - lastUpdateTimestamp;
            uint256 assets = shareSupplyToUse.mulDivDown(currentExchangeRate, ONE_SHARE);
            uint256 platformFeesAnnual = assets.mulDivDown(platformFee, 1e4);
            platformFeesOwedInBase = platformFeesAnnual.mulDivDown(timeDelta, 365 days);
        }
    }

    // ========================================= GETTERS =========================================
    /**
     * @notice Get the current accountant state.
     */
    function getAccountantState() external view returns (AccountantState memory) {
        return accountantState;
    }
}
