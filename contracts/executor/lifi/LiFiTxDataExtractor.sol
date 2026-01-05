// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ILiFi} from "./ILiFi.sol";
import {LibSwap} from "./LibSwap.sol";

/**
 * @title LiFiTxDataExtractor
 * @author LI.FI (https://li.fi)
 * @notice Provides functionality for extracting calldata
 * @notice taken from LiFi contracts https://github.com/lifinance/contracts
 */
contract LiFiTxDataExtractor {
    /**
     * @notice Extracts the bridge data from the calldata. Extracts receiver correctly pending certain facet features
     * @param data The calldata to extract the bridge data from
     * @return bridgeData The bridge data extracted from the calldata
     */
    function _extractBridgeData(bytes calldata data) internal pure returns (ILiFi.BridgeData memory bridgeData) {
        require(data.length >= 4, "Invalid calldata length");
        bridgeData = abi.decode(data[4:], (ILiFi.BridgeData));
    }

    /**
     * @notice Extracts the bridge data from the calldata
     * @param data The calldata to extract the bridge data from
     * @return swapData The swap data extracted from the calldata
     */
    function _extractSwapData(bytes calldata data) internal pure returns (LibSwap.SwapData[] memory swapData) {
        require(data.length >= 4, "Invalid calldata length");
        (, swapData) = abi.decode(data[4:], (ILiFi.BridgeData, LibSwap.SwapData[]));
    }
}
