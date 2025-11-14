// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TellerWithBuffer, ERC20} from "./TellerWithBuffer.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {AccountantWithYieldStreaming} from "./AccountantWithYieldStreaming.sol";
import {ReentrancyGuard} from "solmate/src/utils/ReentrancyGuard.sol";

contract TellerWithYieldStreaming is TellerWithBuffer {
    using FixedPointMathLib for uint256;
    using SafeTransferLib for ERC20;

    constructor(
        address _primeRegistry,
        address _vault,
        address _accountant,
        address _asset,
        address _weth
    ) TellerWithBuffer(_primeRegistry, _vault, _accountant, _asset, _weth) {}

    /**
     * @notice Allows off ramp role to withdraw from this contract.
     * @dev Publicly callable.
     */
    function withdraw(
        uint256 shareAmount,
        uint256 minimumAssets,
        address to
    ) external override requiresAuth nonReentrant returns (uint256 assetsOut) {
        //update vested yield before withdraw
        _getAccountant().updateExchangeRate();
        beforeTransfer(msg.sender, address(0), msg.sender);
        assetsOut = _withdraw(shareAmount, minimumAssets, to);

        emit Withdraw(address(asset), shareAmount);
    }

    function _erc20Deposit(
        ERC20 depositAsset,
        uint256 depositAmount,
        uint256 minimumMint,
        address from,
        address to
    ) internal override returns (uint256 shares) {
        //update vested yield before deposit
        _getAccountant().updateExchangeRate();
        if (vault.totalSupply() == 0) {
            _getAccountant().setFirstDepositTimestamp();
        }
        shares = super._erc20Deposit(depositAsset, depositAmount, minimumMint, from, to);
    }

    /**
     * @notice Allows off ramp role to withdraw from this contract.
     * @dev Callable by SOLVER_ROLE.
     */
    function bulkWithdraw(
        uint256 shareAmount,
        uint256 minimumAssets,
        address to
    ) external override requiresAuth nonReentrant returns (uint256 assetsOut) {
        _getAccountant().updateExchangeRate();
        assetsOut = _withdraw(shareAmount, minimumAssets, to);
        emit BulkWithdraw(address(asset), shareAmount);
    }

    /**
     * @notice Helper function to cast from base accountant type to yield streaming accountant
     */
    function _getAccountant() internal view returns (AccountantWithYieldStreaming) {
        return AccountantWithYieldStreaming(address(accountant));
    }

    /**
     * @notice Returns the version of the contract.
     */
    function version() public pure virtual override returns (string memory) {
        return string(abi.encodePacked("Yield Streaming V0.1, ", super.version()));
    }
}
