// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BaseBridgeExecutor
 * @notice Base contract for bridge executors with common logic
 */
abstract contract BaseBridgeExecutor is Ownable, ReentrancyGuard {
    // ============ State Variables ============

    mapping(address token => mapping(address sender => uint256 amount)) public totalBridgedBySender;
    mapping(address token => uint256 amount) public totalBridged;

    // ============ Events ============

    event BridgeExecuted(
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 amount,
        uint256 timestamp
    );

    event BridgeFailed(string reason);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Internal Helper Functions ============

    /**
     * @notice Decode error message from return data
     */
    function _decodeError(bytes memory data) internal pure returns (string memory) {
        if (data.length < 68) return "Unknown error";
        bytes memory revertData = new bytes(data.length - 4);
        for (uint256 i = 4; i < data.length; i++) {
            revertData[i - 4] = data[i];
        }
        return abi.decode(revertData, (string));
    }

    /**
     * @notice Handle successful bridge execution
     */
    function _recordBridgeSuccess(address token, address sender, address receiver, uint256 amount) internal {
        totalBridgedBySender[token][sender] += amount;
        totalBridged[token] += amount;
        emit BridgeExecuted(sender, receiver, token, amount, block.timestamp);
    }

    /**
     * @notice Handle failed bridge execution with refunds
     */
    function _handleBridgeFailure(
        address token,
        address sender,
        uint256 amount,
        uint256 nativeAmount,
        bytes memory returnData
    ) internal {
        // Refund token if not native
        if (token != address(0)) {
            SafeERC20.safeTransfer(IERC20(token), sender, amount);
        }

        // Refund native if sent
        if (nativeAmount > 0) {
            (bool refundSuccess, ) = sender.call{value: nativeAmount}("");
            require(refundSuccess, "Native refund failed");
        }

        // Decode and emit error
        string memory errorMsg = "Bridge execution failed";
        if (returnData.length > 0) {
            try this._decodeErrorExternal(returnData) returns (string memory decoded) {
                errorMsg = decoded;
            } catch {}
        }

        emit BridgeFailed(errorMsg);
    }

    /**
     * @notice External wrapper for error decoding (allows try-catch)
     */
    function _decodeErrorExternal(bytes memory data) external pure returns (string memory) {
        return _decodeError(data);
    }

    // ============ Admin Functions ============

    function emergencyWithdraw(address _token) external onlyOwner {
        if (_token == address(0)) {
            uint256 balance = address(this).balance;
            require(balance > 0, "No native balance");
            (bool success, ) = owner().call{value: balance}("");
            require(success, "Native withdrawal failed");
        } else {
            uint256 balance = IERC20(_token).balanceOf(address(this));
            require(balance > 0, "No balance");
            SafeERC20.safeTransfer(IERC20(_token), owner(), balance);
        }
    }
}
