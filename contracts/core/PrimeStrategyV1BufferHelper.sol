// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IBufferHelper} from "../interfaces/IBufferHelper.sol";
import {ERC20} from "@solmate/tokens/ERC20.sol";

/**
 * @title PrimeStrategyV1BufferHelper
 * @author PrimeVaults
 * @notice A buffer helper contract that integrates with Prime Strategy V1 strategy manager for automated yield generation
 * @dev Implements the IBufferHelper interface to provide Prime Strategy V1 integration for the TellerWithBuffer contract.
 * This helper automatically manages token approvals and supply/withdraw operations to maximize yield on deposited assets.
 */
contract PrimeStrategyV1BufferHelper is IBufferHelper {
    /// @notice The Prime Strategy V1 strategy manager that handles yield generation
    address public immutable strategyManager;

    /// @notice The associated vault
    address public immutable vault;

    /**
     * @notice Initializes the PrimeStrategyV1BufferHelper contract
     * @param _strategyManager The Prime Strategy V1 strategy manager address
     * @param _vault The associated vault
     */
    constructor(address _strategyManager, address _vault) {
        strategyManager = _strategyManager;
        vault = _vault;
    }

    /**
     * @notice Generates management calls for depositing assets into Prime V1 strategy
     * @param asset The ERC20 token address to be supplied to the strategy manager
     * @param amount The amount of tokens to supply
     * @return targets Array of contract addresses to call
     * @return data Array of encoded function calls
     * @return values Array of ETH values to send with each call (all 0 for ERC20 operations)
     * @dev This function manages token approvals to cover all cases:
     *
     * - If current allowance >= amount: Only supply to strategy manager (1 call)
     * - If current allowance == 0: Approve then supply (2 calls)
     * - If current allowance < amount: Reset approval to 0, approve new amount, then supply (3 calls)
     */
    function getDepositManageCall(
        address asset,
        uint256 amount
    ) public view returns (address[] memory targets, bytes[] memory data, uint256[] memory values) {
        uint256 currentAllowance = ERC20(asset).allowance(vault, strategyManager);
        if (currentAllowance >= amount) {
            targets = new address[](1);
            targets[0] = strategyManager;
            data = new bytes[](1);
            data[0] = abi.encodeWithSignature("deposit(address,uint256,address,uint16)", asset, amount, vault, 0);
            values = new uint256[](1);
            values[0] = 0;
        } else if (currentAllowance == 0) {
            targets = new address[](2);
            targets[0] = asset;
            targets[1] = strategyManager;
            data = new bytes[](2);
            data[0] = abi.encodeWithSignature("approve(address,uint256)", strategyManager, amount);
            data[1] = abi.encodeWithSignature("deposit(address,uint256,address,uint16)", asset, amount, vault, 0);
            values = new uint256[](2);
        } else {
            targets = new address[](3);
            targets[0] = asset;
            targets[1] = asset;
            targets[2] = strategyManager;
            data = new bytes[](3);
            data[0] = abi.encodeWithSignature("approve(address,uint256)", strategyManager, 0);
            data[1] = abi.encodeWithSignature("approve(address,uint256)", strategyManager, amount);
            data[2] = abi.encodeWithSignature("deposit(address,uint256,address,uint16)", asset, amount, vault, 0);
            values = new uint256[](3);
        }
    }

    /**
     * @notice Generates management calls for withdrawing assets from Prime V1 strategy
     * @param asset The ERC20 token address to withdraw from the strategy manager
     * @param amount The amount of tokens to withdraw
     * @return targets Array of contract addresses to call
     * @return data Array of encoded function calls
     * @return values Array of ETH values to send with each call (all 0 for ERC20 operations)
     * @dev Withdraws the specified amount of the asset from the strategy manager and returns it to the vault.
     */
    function getWithdrawManageCall(
        address asset,
        uint256 amount
    ) public view returns (address[] memory targets, bytes[] memory data, uint256[] memory values) {
        targets = new address[](1);
        targets[0] = strategyManager;
        data = new bytes[](1);
        data[0] = abi.encodeWithSignature("withdraw(address,uint256,address)", asset, amount, vault);
        values = new uint256[](1);
        return (targets, data, values);
    }
}
