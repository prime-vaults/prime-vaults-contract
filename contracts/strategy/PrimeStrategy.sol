// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./StrategyManager.sol";
import "../interfaces/IStrategy.sol";

/**
 * @title PrimeStrategy
 * @dev Prime Strategy functionality for deposits, withdrawals and tracking deposited tokens
 */
contract PrimeStrategy is StrategyManager {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public deposited;
    address[] public allowList;
    mapping(address => bool) public isAllowedToken;

    //walletAddress->token->amount
    mapping(address => mapping(address => uint256)) depositor;

    /**
     * @dev Initializes the PrimeStrategy contract
     * @param _manager Address to be granted the manager role
     * @param _vaultRegistry Address of the vault registry contract
     * @param _treasury Address where harvested rewards will be sent
     */
    constructor(address _manager, address _vaultRegistry, address _treasury) StrategyManager(_vaultRegistry, _manager, _treasury, msg.sender) {}

    /* ===================== ADMIN ACTION ===================== */

    function addAllowToken(address token) external onlyAdmin {
        if (token == address(0)) revert VAULT__ZERO_ADDRESS();
        if (isAllowedToken[token]) revert VAULT__TOKEN_ALREADY_ALLOWED();

        isAllowedToken[token] = true;
        allowList.push(token);
    }

    function removeAllowToken(address token) external onlyAdmin {
        if (token == address(0)) revert VAULT__ZERO_ADDRESS();
        if (!isAllowedToken[token]) revert VAULT__TOKEN_NOT_ALLOWED();
        isAllowedToken[token] = false;
    }

    /*---------- CORE LOGIC ----------*/

    /**
     * @dev Deposits tokens into the vault from prime vault
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        if (amount <= 0) revert VAULT__ZERO_AMOUNT();
        if (token == address(0)) revert VAULT__ZERO_ADDRESS();
        if (!isAllowedToken[token]) revert VAULT__INVALID_DEPOSIT_TOKEN();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposited[token] += amount;
        depositor[msg.sender][token] += amount;

        emit Deposited(token, amount, msg.sender);
    }

    /**
     * @dev Withdraws tokens from the vault to prime vault, pulling from strategies if needed
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount <= 0) revert VAULT__ZERO_AMOUNT();
        if (token == address(0)) revert VAULT__ZERO_ADDRESS();

        uint256 amountDeposited = depositor[msg.sender][token];
        if (amountDeposited < amount) revert VAULT__INSUFFICIENT_BALANCE();
        depositor[msg.sender][token] -= amount;

        uint256 idle = IERC20(token).balanceOf(address(this));
        uint256 shortfall = amount > idle ? amount - idle : 0;

        if (shortfall > 0) {
            for (uint256 i; i < withdrawPriority.length && shortfall > 0; ) {
                WithdrawPriority memory wq = withdrawPriority[i];
                uint256 withdrawn = 0;

                try this.withdrawFromStrategy(wq.kind, wq.allocKey, shortfall, token) returns (uint256 w) {
                    withdrawn = w;
                    shortfall = withdrawn >= shortfall ? 0 : shortfall - withdrawn;
                } catch {
                    withdrawn = 0;
                }
                unchecked {
                    ++i;
                }
            }

            if (shortfall > 0) revert VAULT__INSUFFICIENT_FUNDS();
        }

        uint256 afterBalance = IERC20(token).balanceOf(address(this));
        if (afterBalance < amount) revert VAULT__INSUFFICIENT_FUNDS();

        uint256 dep = deposited[token];
        deposited[token] = amount >= dep ? 0 : dep - amount;

        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, amount, msg.sender);
    }

    function withdrawFromStrategy(StrategyKind kind, bytes32 allocKey, uint256 amount, address token) external returns (uint256) {
        require(msg.sender == address(this), "Only internal calls");

        if (kind == StrategyKind.SingleAsset) {
            return _withdrawSingle(allocKey, amount, token);
        } else {
            return _withdrawPair(allocKey, amount, token);
        }
    }

    /*---------- INTERNAL ----------*/

    /**
     * @dev Internal function to withdraw from a single asset allocation
     * @param key Unique identifier of the single allocation
     * @param want Amount desired to withdraw
     * @param _token Address of the token to withdraw
     * @return withdrawn Actual amount withdrawn from the strategy
     */
    function _withdrawSingle(bytes32 key, uint256 want, address _token) internal returns (uint256 withdrawn) {
        SingleAllocation storage alloc = singleAllocs[key];
        if (!alloc.exists) return 0;

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(alloc.strategy);
        if (kind != StrategyKind.SingleAsset) revert VAULT__INVALID_STRATEGY_KIND();
        if (alloc.token != _token || !active) return 0;

        uint256 allocated = alloc.allocated;
        if (allocated == 0) return 0;

        uint256 toWithdraw = want > allocated ? allocated : want;

        uint256 got = ISingleAssetStrategy(alloc.strategy).withdraw(alloc.token, toWithdraw);

        // avoid underflow if strategy returns higher amount than allocated
        if (got > allocated) got = allocated;

        alloc.allocated -= got;
        withdrawn = got;
    }

    /**
     * @dev Internal function to withdraw from a pair asset allocation
     * @param key Unique identifier of the pair allocation
     * @param want Amount desired to withdraw
     * @param _token Address of the token to withdraw (must be tokenA or tokenB)
     * @return withdrawn Actual amount withdrawn from the strategy
     */
    function _withdrawPair(bytes32 key, uint256 want, address _token) internal returns (uint256 withdrawn) {
        PairAllocation storage alloc = pairAllocs[key];
        if (!alloc.exists) return 0;

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(alloc.strategy);
        if (kind != StrategyKind.PairAsset) revert VAULT__INVALID_STRATEGY_KIND();
        if (!active) return 0;

        address stra = alloc.strategy;
        uint256 toWithdrawA = 0;
        uint256 toWithdrawB = 0;

        if (_token == alloc.tokenA && alloc.allocatedA != 0) {
            toWithdrawA = want > alloc.allocatedA ? alloc.allocatedA : want;
        } else if (_token == alloc.tokenB && alloc.allocatedB != 0) {
            toWithdrawB = want > alloc.allocatedB ? alloc.allocatedB : want;
        }
        if (toWithdrawA == 0 && toWithdrawB == 0) return 0;

        (uint256 outA, uint256 outB) = IPairAssetStrategy(stra).withdrawByAmounts(alloc.tokenA, toWithdrawA, alloc.tokenB, toWithdrawB);

        if (outA > alloc.allocatedA) outA = alloc.allocatedA;
        if (outB > alloc.allocatedB) outB = alloc.allocatedB;

        alloc.allocatedA -= outA;
        alloc.allocatedB -= outB;

        bool isTokenA = _token == alloc.tokenA;
        if (isTokenA) withdrawn = outA;
        else withdrawn = outB;
    }

    /**
     * @dev Returns all deposited tokens with their amounts
     * @return tokens Array of TokenDepositedView structs containing token addresses and amounts
     */
    function getTokenDeposited() external view returns (TokenDepositedView[] memory tokens) {
        uint256 len = allowList.length;
        tokens = new TokenDepositedView[](len);

        for (uint256 i = 0; i < len; ) {
            address token = allowList[i];
            tokens[i] = TokenDepositedView({token: token, amount: deposited[token]});
            unchecked {
                ++i;
            }
        }
    }
}
