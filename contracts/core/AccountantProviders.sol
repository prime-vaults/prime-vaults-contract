// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {BoringVault} from "./BoringVault.sol";
import {IAccountant} from "../interfaces/IAccountant.sol";

import {PrimeAuth} from "../auth/PrimeAuth.sol";

contract AccountantProviders is PrimeAuth, IAccountant {
    using FixedPointMathLib for uint256;
    using SafeTransferLib for ERC20;

    /* ========================================= STRUCTS ========================================= */

    /**
     * @notice Packed accountant state (3 storage slots)
     * @param payoutAddress Address to receive claimed fees
     * @param exchangeRate Current share price (base asset per share)
     * @param feesOwedInBase Accumulated fees pending claim (in base asset)
     * @param totalSharesLastUpdate Total vault shares at last update
     * @param lastUpdateTimestamp Last exchange rate update timestamp
     * @param platformFee Annual fee rate in basis points (e.g., 1000 = 10%)
     */
    struct AccountantState {
        address payoutAddress;
        uint96 exchangeRate;
        uint128 feesOwedInBase;
        uint128 totalSharesLastUpdate;
        uint64 lastUpdateTimestamp;
        uint16 platformFee;
    }

    /* ========================================= STATE ========================================= */

    /** @notice Accountant state stored */
    AccountantState public accountantState;

    /* ========================================= IMMUTABLES ========================================= */

    /** @notice Base asset for exchange rate and fee calculations */
    ERC20 public immutable base;

    /** @notice BoringVault contract for share supply queries */
    BoringVault public immutable vault;

    /** @notice One share unit (10^decimals) */
    uint256 internal immutable ONE_SHARE;

    /**
     * @notice Initialize accountant with vault and fee configuration
     * @param _primeRBAC PrimeRBAC contract for protocol-level roles
     * @param _vault BoringVault address
     * @param _payoutAddress Address to receive claimed fees
     * @param platformFee Initial platform fee in basis points
     */
    constructor(address _primeRBAC, address _vault, address _payoutAddress, uint16 platformFee) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
        vault = BoringVault(payable(_vault));
        base = vault.asset();
        ONE_SHARE = 10 ** vault.decimals();
        accountantState = AccountantState({
            payoutAddress: _payoutAddress,
            feesOwedInBase: 0,
            totalSharesLastUpdate: uint128(vault.totalSupply()),
            exchangeRate: uint96(10 ** base.decimals()),
            lastUpdateTimestamp: uint64(block.timestamp),
            platformFee: platformFee
        });
    }

    /* ========================================= ADMIN FUNCTIONS ========================================= */

    /**
     * @notice Update platform fee (max 20% = 2000 bps)
     * @dev Restricted to PROTOCOL_ADMIN_ROLE
     * @param platformFee New annual fee rate in basis points
     */
    function updatePlatformFee(uint16 platformFee) external onlyProtocolAdmin {
        if (platformFee > 0.2e4) revert AccountantProviders__PlatformFeeTooLarge();
        uint16 oldFee = accountantState.platformFee;
        accountantState.platformFee = platformFee;
        emit PlatformFeeUpdated(oldFee, platformFee);
    }

    /**
     * @notice Update fee recipient address
     * @dev Restricted to PROTOCOL_ADMIN_ROLE
     * @param payoutAddress New fee recipient
     */
    function updatePayoutAddress(address payoutAddress) external onlyProtocolAdmin {
        address oldPayout = accountantState.payoutAddress;
        accountantState.payoutAddress = payoutAddress;
        emit PayoutAddressUpdated(oldPayout, payoutAddress);
    }

    /* ========================================= EXCHANGE RATE & FEES ========================================= */

    /**
     * @notice Update exchange rate and accrue platform fees
     * @dev Calculates time-based fees and reduces exchange rate accordingly
     * @dev Formula: newRate = (totalAssets - feesOwed) / totalShares
     * @dev Restricted to STRATEGIST_ROLE (via requiresAuth)
     */
    function updateExchangeRate() public virtual requiresAuth {
        AccountantState storage state = accountantState;
        if (isPaused) revert AccountantProviders__Paused();

        uint64 currentTime = uint64(block.timestamp);
        uint96 oldExchangeRate = state.exchangeRate;
        uint256 currentShares = vault.totalSupply();

        // Calculate platform fees
        uint256 newFeesOwedInBase = _calculatePlatformFee(state.totalSharesLastUpdate, state.lastUpdateTimestamp, state.platformFee, oldExchangeRate, currentShares, currentTime);
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
     * @notice Claim accumulated fees and transfer to payout address
     * @dev MUST be called via BoringVault.manage() (msg.sender == vault)
     * @dev Auto-updates exchange rate before claiming
     * @dev Vault must have approved this contract to spend base asset
     */
    function claimFees() external {
        if (msg.sender != address(vault)) revert AccountantProviders__OnlyCallableByBoringVault();

        AccountantState storage state = accountantState;
        if (isPaused) revert AccountantProviders__Paused();

        this.updateExchangeRate();
        if (state.feesOwedInBase == 0) revert AccountantProviders__ZeroFeesOwed();

        uint256 feesOwed = state.feesOwedInBase;

        // Zero out fees owed.
        state.feesOwedInBase = 0;

        // Transfer base asset to payout address.
        base.safeTransferFrom(msg.sender, state.payoutAddress, feesOwed);

        emit FeesClaimed(address(base), feesOwed);
    }

    /* ========================================= VIEW FUNCTIONS ========================================= */

    /** @notice Get current exchange rate (base asset per share) */
    function getRate() public view virtual returns (uint256 rate) {
        rate = accountantState.exchangeRate;
    }

    /**
     * @notice Get current exchange rate (reverts if paused)
     * @dev Use this for critical operations that should fail when paused
     */
    function getRateSafe() external view virtual returns (uint256 rate) {
        if (isPaused) revert AccountantProviders__Paused();
        rate = getRate();
    }

    /* ========================================= INTERNAL HELPERS ========================================= */

    /**
     * @notice Calculate platform fees based on time elapsed and share supply
     * @dev Formula: fees = (shares * exchangeRate * platformFee * timeDelta) / (10000 * 365 days)
     * @dev Uses max(currentShares, lastShares) to prevent fee evasion via withdrawals
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

    /* ========================================= GETTERS ========================================= */

    /** @notice Get full accountant state  */
    function getAccountantState() external view returns (AccountantState memory) {
        return accountantState;
    }
}
