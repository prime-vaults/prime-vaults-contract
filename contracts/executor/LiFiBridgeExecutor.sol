// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LiFiTxDataExtractor, LibSwap, ILiFi} from "./lifi/LiFiTxDataExtractor.sol";
import {BaseBridgeExecutor} from "./BaseBridgeExecutor.sol";

/**m
 * @title LiFiBridgeExecutor
 * @notice Execute LiFi bridge
 */
contract LiFiBridgeExecutor is BaseBridgeExecutor, LiFiTxDataExtractor {
    // ============ State Variables ============

    address public lifiDiamond;

    // ============ Events ============

    event LiFiDiamondUpdated(address indexed newAddress);

    // ============ Constructor ============

    constructor(address _lifiDiamond) {
        require(_lifiDiamond != address(0), "Invalid LiFi address");
        lifiDiamond = _lifiDiamond;
    }

    // ============ Core Function ============

    /**
     * @notice Execute LiFi bridge
     * @param data_ Transaction data from LiFi API
     */
    function execute(bytes calldata data_) external payable nonReentrant {
        require(data_.length > 0, "Invalid transaction request");

        address sender = msg.sender;
        (address sendingAssetId, address receiver, uint256 amount) = this.extractMainParameters(data_);
        require(amount > 0, "Invalid amount");
        require(receiver != address(0), "Invalid receiver");

        // Check if sendingAssetId is native
        if (sendingAssetId == address(0)) {
            require(msg.value >= amount, "Insufficient native");
        } else {
            // Transfer token from sender → contract
            SafeERC20.safeTransferFrom(IERC20(sendingAssetId), sender, address(this), amount);
            // Approve target address to spend token
            SafeERC20.forceApprove(IERC20(sendingAssetId), lifiDiamond, amount);
        }

        // Execute LiFi call
        (bool success, bytes memory returnData) = lifiDiamond.call{value: msg.value}(data_);

        if (success) {
            _recordBridgeSuccess(sendingAssetId, sender, receiver, amount);
        } else {
            _handleBridgeFailure(sendingAssetId, sender, amount, msg.value, returnData);
        }
    }

    /**
     * @notice Extract main parameters from calldata
     * @param data_ The calldata to extract the main parameters from
     * @return sendingAssetId The sending asset id extracted from the calldata
     * @return receiver The receiver extracted from the calldata
     * @return amount The amount the calldata (which may be equal to bridge min amount)
     */
    function extractMainParameters(
        bytes calldata data_
    ) public pure returns (address sendingAssetId, address receiver, uint256 amount) {
        ILiFi.BridgeData memory bridgeData = _extractBridgeData(data_);

        if (bridgeData.hasSourceSwaps) {
            LibSwap.SwapData[] memory swapData = _extractSwapData(data_);
            require(swapData.length > 0, "No swap data found");
            sendingAssetId = swapData[0].sendingAssetId;
            amount = swapData[0].fromAmount;
        } else {
            sendingAssetId = bridgeData.sendingAssetId;
            amount = bridgeData.minAmount;
        }
        return (sendingAssetId, bridgeData.receiver, amount);
    }

    // ============ Admin Functions ============

    function setLiFiDiamond(address _newLiFi) external onlyOwner {
        require(_newLiFi != address(0), "Invalid address");
        lifiDiamond = _newLiFi;
        emit LiFiDiamondUpdated(_newLiFi);
    }
}
