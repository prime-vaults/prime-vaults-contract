// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IOFT, SendParam, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

/**
 * @title StargateTxDataExtractor
 * @author Stargate (https://stargate.finance/)
 * @notice Provides functionality for extracting calldata
 * @notice Taken from Stargate contracts https://github.com/stargate-protocol/stargate-v2/blob/main/packages/stg-evm-v2/src/interfaces/IStargate.sol
 */
contract StargateTxDataExtractor {
    /**
     * @notice Extracts Stargate send parameters from encoded calldata
     * @param data The calldata to extract parameters from
     * @return sendParam SendParam containing amount, receiver, and other bridge details
     * @return fee MessagingFee for the bridge operation
     * @return refundAddress Address to receive refunds if operation fails
     */
    function _extractSendData(
        bytes calldata data
    ) internal pure returns (SendParam memory sendParam, MessagingFee memory fee, address refundAddress) {
        require(data.length >= 4, "Invalid calldata length");
        (sendParam, fee, refundAddress) = abi.decode(data[4:], (SendParam, MessagingFee, address));
    }
}
