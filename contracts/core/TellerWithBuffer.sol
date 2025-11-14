// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TellerWithMultiAssetSupport, ERC20} from "./TellerWithMultiAssetSupport.sol";
import {IBufferHelper} from "../interfaces/IBufferHelper.sol";

/**
 * @title TellerWithBuffer
 * @author PrimeVaults Labs
 * @notice A teller contract that integrates with buffer helpers to manage deposits and withdrawals
 * @dev Extends TellerWithMultiAssetSupport to add automatic yield and withdrawal buffer capabilities.
 * The buffer helpers can trigger additional vault management calls during these operations.
 */
contract TellerWithBuffer is TellerWithMultiAssetSupport {
    //============================== STRUCTS ===============================
    struct BufferHelpers {
        IBufferHelper depositBufferHelper;
        IBufferHelper withdrawBufferHelper;
    }

    //============================== STATE ===============================
    BufferHelpers public bufferHelpers;

    mapping(IBufferHelper => bool) public allowedBufferHelpers;

    //============================== ERRORS ===============================
    error TellerWithBuffer__BufferHelperNotAllowed(IBufferHelper bufferHelper);

    //============================== EVENTS ===============================
    event DepositBufferHelperSet(IBufferHelper indexed newDepositBufferHelper);
    event WithdrawBufferHelperSet(IBufferHelper indexed newWithdrawBufferHelper);
    event BufferHelperAllowed(IBufferHelper indexed bufferHelper);
    event BufferHelperDisallowed(IBufferHelper indexed bufferHelper);

    /**
     * @notice Initializes the TellerWithBuffer contract
     * @param _primeRegistry The address that will have owner privileges
     * @param _vault The vault contract address this teller will interact with
     * @param _accountant The accountant contract address associated with the vault
     * @param _asset The single asset this teller supports
     * @param _weth The WETH token address for ETH wrapping/unwrapping operations
     */
    constructor(
        address _primeRegistry,
        address _vault,
        address _accountant,
        address _asset,
        address _weth
    ) TellerWithMultiAssetSupport(_primeRegistry, _vault, _accountant, _asset, _weth) {}

    /**
     * @notice Executes buffer management after a deposit operation
     * @param assetAmount The amount of the asset deposited
     * @dev This function is called internally after a deposit is processed.
     * If a deposit buffer helper is configured, it will retrieve management calls
     * and execute them through the vault's manage function.
     */
    function _afterDeposit(uint256 assetAmount) internal override {
        if (address(bufferHelpers.depositBufferHelper) != address(0)) {
            (address[] memory targets, bytes[] memory data, uint256[] memory values) = bufferHelpers
                .depositBufferHelper
                .getDepositManageCall(address(asset), assetAmount);
            vault.manage(targets, data, values);
        }
    }

    /**
     * @notice Executes buffer management before a withdrawal operation
     * @param assetAmount The amount of the asset being withdrawn
     * @dev This function is called internally before a withdrawal is processed.
     * If a withdraw buffer helper is configured, it will retrieve management calls
     * and execute them through the vault's manage function.
     */
    function _beforeWithdraw(uint256 assetAmount) internal override {
        if (address(bufferHelpers.withdrawBufferHelper) != address(0)) {
            (address[] memory targets, bytes[] memory data, uint256[] memory values) = bufferHelpers
                .withdrawBufferHelper
                .getWithdrawManageCall(address(asset), assetAmount);
            vault.manage(targets, data, values);
        }
    }

    /**
     * @notice Updates the deposit buffer helper contract
     * @param _depositBufferHelper The new deposit buffer helper contract address
     * @dev Only callable by authorized accounts. This allows for dynamic updates
     * to the deposit management strategy without requiring contract redeployment.
     */
    function setDepositBufferHelper(IBufferHelper _depositBufferHelper) external onlyProtocolAdmin {
        if (allowedBufferHelpers[_depositBufferHelper] || _depositBufferHelper == IBufferHelper(address(0))) {
            bufferHelpers.depositBufferHelper = _depositBufferHelper;
            emit DepositBufferHelperSet(_depositBufferHelper);
        } else {
            revert TellerWithBuffer__BufferHelperNotAllowed(_depositBufferHelper);
        }
    }

    /**
     * @notice Updates the withdrawal buffer helper contract
     * @param _withdrawBufferHelper The new withdrawal buffer helper contract address
     * @dev Only callable by authorized accounts. This allows for dynamic updates
     * to the withdrawal management strategy without requiring contract redeployment.
     */
    function setWithdrawBufferHelper(IBufferHelper _withdrawBufferHelper) external onlyProtocolAdmin {
        if (allowedBufferHelpers[_withdrawBufferHelper] || _withdrawBufferHelper == IBufferHelper(address(0))) {
            bufferHelpers.withdrawBufferHelper = _withdrawBufferHelper;
            emit WithdrawBufferHelperSet(_withdrawBufferHelper);
        } else {
            revert TellerWithBuffer__BufferHelperNotAllowed(_withdrawBufferHelper);
        }
    }

    /**
     * @notice Allows a buffer helper to be used
     * @param _bufferHelper The buffer helper contract address to allow
     * @dev Only callable by admin to allowlist buffer helpers
     */
    function allowBufferHelper(IBufferHelper _bufferHelper) external onlyProtocolAdmin {
        allowedBufferHelpers[_bufferHelper] = true;
        emit BufferHelperAllowed(_bufferHelper);
    }

    /**
     * @notice Disallows a buffer helper from being used
     * @param _bufferHelper The buffer helper contract address to disallow
     * @dev Only callable by admin to disallow buffer helpers
     */
    function disallowBufferHelper(IBufferHelper _bufferHelper) external requiresAuth {
        allowedBufferHelpers[_bufferHelper] = false;
        emit BufferHelperDisallowed(_bufferHelper);
    }

    /**
     * @notice Returns the version of the contract.
     */
    function version() public pure virtual override returns (string memory) {
        return string(abi.encodePacked("Buffer V0.1, ", super.version()));
    }
}
