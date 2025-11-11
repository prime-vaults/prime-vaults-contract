// SPDX-License-Identifier: MIT
// Copyright © 2025 PrimeVaults Labs
// Licensed under MIT License
pragma solidity 0.8.30;

import {IBufferHelper} from "../interfaces/IBufferHelper.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

/**
 * @title PrimeBufferHelper
 * @author PrimeVaults Labs
 * @notice A buffer helper contract that integrates with Prime Strategist for automated yield generation
 * @dev Implements the IBufferHelper interface to provide Prime integration for the TellerWithBuffer contract.
 * This helper automatically manages token approvals and deposit/withdraw operations to maximize yield on deposited assets.
 */
contract PrimeBufferHelper is IBufferHelper {
    /// @notice The Prime strategist address that manages deposits
    address public immutable primeStrategist;

    /// @notice The associated vault address
    address public immutable vault;

    /**
     * @notice Initializes the PrimeBufferHelper contract
     * @param _primeStrategist The Prime strategist address
     * @param _vault The associated vault address
     */
    constructor(address _primeStrategist, address _vault) {
        primeStrategist = _primeStrategist;
        vault = _vault;
    }

    /**
     * @notice Generates management calls for depositing assets into Prime Strategist
     * @param asset The ERC20 token address to be deposited to Prime
     * @param amount The amount of tokens to deposit
     * @return targets Array of contract addresses to call
     * @return data Array of encoded function calls
     * @return values Array of ETH values to send with each call (all 0 for ERC20 operations)
     * @dev This function manages token approvals to cover all cases:
     *
     * - If current allowance >= amount: Only deposit to Prime (1 call)
     * - If current allowance == 0: Approve then deposit (2 calls)
     * - If current allowance < amount: Reset approval to 0, approve new amount, then deposit (3 calls)
     */
    function getDepositManageCall(
        address asset,
        uint256 amount
    ) public view returns (address[] memory targets, bytes[] memory data, uint256[] memory values) {
        uint256 currentAllowance = ERC20(asset).allowance(vault, primeStrategist);
        if (currentAllowance >= amount) {
            targets = new address[](1);
            targets[0] = primeStrategist;
            data = new bytes[](1);
            data[0] = abi.encodeWithSignature("deposit(address,uint256)", asset, amount);
            values = new uint256[](1);
            values[0] = 0;
        } else if (currentAllowance == 0) {
            targets = new address[](2);
            targets[0] = asset;
            targets[1] = primeStrategist;
            data = new bytes[](2);
            data[0] = abi.encodeWithSignature("approve(address,uint256)", primeStrategist, amount);
            data[1] = abi.encodeWithSignature("deposit(address,uint256)", asset, amount);
            values = new uint256[](2);
        } else {
            targets = new address[](3);
            targets[0] = asset;
            targets[1] = asset;
            targets[2] = primeStrategist;
            data = new bytes[](3);
            data[0] = abi.encodeWithSignature("approve(address,uint256)", primeStrategist, 0);
            data[1] = abi.encodeWithSignature("approve(address,uint256)", primeStrategist, amount);
            data[2] = abi.encodeWithSignature("deposit(address,uint256)", asset, amount);
            values = new uint256[](3);
        }
    }

    /**
     * @notice Generates management calls for withdrawing assets from Prime Strategist
     * @param asset The ERC20 token address to withdraw from Prime
     * @param amount The amount of tokens to withdraw
     * @return targets Array of contract addresses to call
     * @return data Array of encoded function calls
     * @return values Array of ETH values to send with each call (all 0 for ERC20 operations)
     * @dev Withdraws the specified amount of the asset from Prime Strategist and returns it to the vault.
     */
    function getWithdrawManageCall(
        address asset,
        uint256 amount
    ) public view returns (address[] memory targets, bytes[] memory data, uint256[] memory values) {
        targets = new address[](1);
        targets[0] = primeStrategist;
        data = new bytes[](1);
        data[0] = abi.encodeWithSignature("withdraw(address,uint256,address)", asset, amount, vault);
        values = new uint256[](1);
        return (targets, data, values);
    }
}
