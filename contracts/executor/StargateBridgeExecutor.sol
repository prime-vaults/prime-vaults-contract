// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {StargateTxDataExtractor, SendParam, MessagingFee} from "./stargate/StargateTxDataExtractor.sol";
import {BaseBridgeExecutor} from "./BaseBridgeExecutor.sol";

/**
 * @title StargateBridgeExecutor
 * @notice Execute send call by Stargate
 */
contract StargateBridgeExecutor is BaseBridgeExecutor, StargateTxDataExtractor {
    /// @notice Mapping to track whitelisted bridge contract addresses
    mapping(address => bool) public whitelist;

    /// @notice Maximum gas fee amount allowed per transaction (in Wei)
    uint256 public maxFeeAllowed;

    /// @notice Total amount sponsored
    uint256 public totalSponsored = 0;

    /// @notice Emitted when an address is added to the whitelist
    event WhitelistAdded(address indexed user);

    /// @notice Emitted when an address is removed from the whitelist
    event WhitelistRemoved(address indexed user);

    /// @notice Emitted when funds are deposited into the contract
    event FundsDeposited(address indexed depositor, uint256 amount);

    /// @notice Emitted when funds are withdrawn from the contract
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    /// @notice Emitted when the maximum fee allowed is updated
    event MaxFeeUpdated(uint256 maxFee);

    /// @notice Modifier to ensure only whitelisted addresses can relay transactions
    modifier onlyWhitelisted(address _to) {
        require(whitelist[_to], "Address not in whitelist");
        _;
    }

    // ============ Constructor ============
    constructor() {}

    /// @notice Fallback function to receive native and emit deposit event
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    // ============ Core Function ============

    /**
     * @notice Execute bridge call
     * @param to_ The address to call with data_b
     * @param data_ Transaction data to execute
     * @param token_ Token address to bridge
     */
    function execute(
        address to_,
        bytes calldata data_,
        address token_
    ) external payable nonReentrant onlyWhitelisted(to_) {
        require(to_ != address(0), "Invalid target address");
        require(data_.length > 0, "Invalid transaction request");

        address sender = msg.sender;
        (SendParam memory sendParam, , ) = _extractSendData(data_);

        uint256 amount = sendParam.amountLD;
        address receiver = address(uint160(uint256(sendParam.to)));

        require(amount > 0, "Invalid amount");
        require(receiver != address(0), "Invalid receiver address");

        // Check if token_ is native
        if (token_ == address(0)) {
            require(msg.value >= amount, "Insufficient native sent");
        } else {
            // Transfer token from sender → contract
            SafeERC20.safeTransferFrom(IERC20(token_), sender, address(this), amount);
            SafeERC20.forceApprove(IERC20(token_), to_, amount);
        }

        (bool success, bytes memory returnData) = to_.call{value: msg.value}(data_);

        if (token_ != address(0)) {
            SafeERC20.forceApprove(IERC20(token_), to_, 0);
        }

        if (success) {
            _recordBridgeSuccess(token_, sender, receiver, amount);
        } else {
            _handleBridgeFailure(token_, sender, amount, msg.value, returnData);
        }
    }

    /**
     * @notice Execute bridge call with sponsorship
     * @param to_ The address to call with data_
     * @param data_ Transaction data to execute
     * @param token_ Token address to bridge
     */
    function executeSponsored(
        address to_,
        bytes calldata data_,
        address token_
    ) external nonReentrant onlyWhitelisted(to_) {
        require(to_ != address(0), "Invalid target address");
        require(token_ != address(0), "Not supported token");
        require(data_.length > 0, "Invalid transaction request");

        address sender = msg.sender;
        (SendParam memory sendParam, MessagingFee memory fee, ) = _extractSendData(data_);

        uint256 amount = sendParam.amountLD;
        address receiver = address(uint160(uint256(sendParam.to)));

        require(amount > 0, "Invalid amount");
        require(receiver != address(0), "Invalid receiver address");
        require(fee.nativeFee > 0 && fee.nativeFee <= maxFeeAllowed, "Invalid fee amount");

        // Transfer token from sender → contract
        SafeERC20.safeTransferFrom(IERC20(token_), sender, address(this), amount);
        SafeERC20.forceApprove(IERC20(token_), to_, amount);

        // Use sponsor balance as value
        (bool success, bytes memory returnData) = to_.call{value: fee.nativeFee}(data_);

        SafeERC20.forceApprove(IERC20(token_), to_, 0);

        if (success) {
            totalSponsored += amount;
            _recordBridgeSuccess(token_, sender, receiver, amount);
        } else {
            _handleBridgeFailure(token_, sender, amount, 0, returnData);
        }
    }

    // ============ Internal Helper Functions ============

    /**
     * @notice Adds a single address to the whitelist
     * @param _user The address to be whitelisted
     * @dev Only callable by contract owner
     * @dev Reverts if address is already whitelisted or is zero address
     */
    function addToWhitelist(address _user) external onlyOwner {
        require(_user != address(0), "Invalid address");
        require(!whitelist[_user], "Already in whitelist");
        whitelist[_user] = true;
        emit WhitelistAdded(_user);
    }

    /**
     * @notice Removes a single address from the whitelist
     * @param _user The address to be removed from whitelist
     * @dev Only callable by contract owner
     * @dev Reverts if address is not in whitelist
     */
    function removeFromWhitelist(address _user) external onlyOwner {
        require(whitelist[_user], "Not in whitelist");
        whitelist[_user] = false;
        emit WhitelistRemoved(_user);
    }

    /**
     * @notice Adds multiple addresses to the whitelist in a single transaction
     * @param _users Array of addresses to be whitelisted
     * @dev Only callable by contract owner
     * @dev Reverts if array is empty or exceeds 100 addresses
     */
    function addMultipleToWhitelist(address[] calldata _users) external onlyOwner {
        require(_users.length > 0, "Empty array");
        require(_users.length <= 100, "Too many addresses");
        for (uint256 i = 0; i < _users.length; i++) {
            require(_users[i] != address(0), "Invalid address");
            if (!whitelist[_users[i]]) {
                whitelist[_users[i]] = true;
                emit WhitelistAdded(_users[i]);
            }
        }
    }

    /**
     * @notice Sets the maximum gas fee amount allowed for all relay transactions
     * @param _maxFee The maximum fee amount in Wei
     * @dev Only callable by contract owner
     * @dev Reverts if _maxFee is zero
     */
    function setMaxFeeAllowed(uint256 _maxFee) external onlyOwner {
        require(_maxFee > 0, "Max fee must be greater than 0");
        maxFeeAllowed = _maxFee;
        emit MaxFeeUpdated(_maxFee);
    }

    /**
     * @notice Deposits native into the contract to be used for sponsoring gas fees
     * @dev Only callable by contract owner
     * @dev Reverts if msg.value is zero
     */
    function depositFunds() external payable onlyOwner {
        require(msg.value > 0, "Must send some funds");
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraws a specified amount of native from the contract
     * @param _amount The amount of native to withdraw in Wei
     * @dev Only callable by contract owner
     * @dev Reverts if amount is zero or exceeds contract balance
     */
    function withdrawFunds(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= _amount, "Insufficient balance");

        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Withdrawal failed");

        emit FundsWithdrawn(owner(), _amount);
    }

    /**
     * @notice Withdraws all native from the contract
     * @dev Only callable by contract owner
     * @dev Reverts if contract balance is zero
     */
    function withdrawAllFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");

        emit FundsWithdrawn(owner(), balance);
    }
}
