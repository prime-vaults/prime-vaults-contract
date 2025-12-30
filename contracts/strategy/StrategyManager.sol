// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ISingleAssetStrategy, IPairAssetStrategy, StrategyKind} from "../interfaces/IStrategy.sol";
import "../interfaces/IPrimeStrategy.sol";

/**
 * @title StrategyManager
 * @dev Manages strategy allocations across single and pair asset strategies with access control
 */
contract StrategyManager is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address public treasury;
    address public immutable strategyRegistry;

    WithdrawPriority[] public withdrawPriority;

    mapping(bytes32 => SingleAllocation) public singleAllocs;
    bytes32[] public singleKeys;

    mapping(bytes32 => PairAllocation) public pairAllocs;
    bytes32[] public pairKeys;

    mapping(address => uint256) public topup;
    mapping(address => address[]) public swapped;

    /**
     * @dev Initializes the contract with registry, manager, and treasury addresses
     * @param _strategyRegistry Address of the vault registry contract
     * @param _manager Address to be granted the manager role
     * @param _treasury Address where harvested rewards will be sent
     */
    constructor(address _strategyRegistry, address _manager, address _treasury, address _admin) {
        if (_strategyRegistry == address(0)) revert VAULT__ZERO_ADDRESS();
        if (_manager == address(0)) revert VAULT__ZERO_ADDRESS();
        if (_treasury == address(0)) revert VAULT__ZERO_ADDRESS();
        if (_admin == address(0)) revert VAULT__ZERO_ADDRESS();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _manager);
        strategyRegistry = _strategyRegistry;
        treasury = _treasury;
    }

    /* ===================== Modifiers ===================== */

    /**
     * @dev Restricts function access to admin role holders only
     */
    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert VAULT__NOT_ADMIN();
        _;
    }

    /**
     * @dev Restricts function access to manager role holders only
     */
    modifier onlyManager() {
        if (!hasRole(MANAGER_ROLE, msg.sender)) revert VAULT__NOT_MANAGER();
        _;
    }

    /* ===================== Key helpers ===================== */

    /**
     * @dev Generates a unique key for single asset allocations using keccak256 hash
     * @param stra Address of the strategy contract
     * @param token Address of the token
     * @return Unique bytes32 key for the allocation
     */
    function _singleKey(address stra, address token) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(stra, token));
    }

    /**
     * @dev Generates a unique key for pair asset allocations with consistent ordering
     * @param stra Address of the strategy contract
     * @param a Address of the first token
     * @param b Address of the second token
     * @return Unique bytes32 key for the allocation
     */
    function _pairKey(address stra, address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(stra, a, b)) : keccak256(abi.encodePacked(stra, b, a));
    }

    /* ===================== Execute Allocation ===================== */

    /**
     * @dev Executes single asset allocation by depositing to or withdrawing from a strategy
     * @param key The unique identifier for the single allocation
     */
    function executeAllocSingle(bytes32 key) external onlyManager nonReentrant {
        SingleAllocation storage alloc = singleAllocs[key];
        if (!alloc.exists) revert VAULT__ALLOCATION_NOT_FOUND();

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(alloc.strategy);
        if (!active) revert VAULT__STRATEGY_NOT_ACTIVE();
        if (kind != StrategyKind.SingleAsset) revert VAULT__INVALID_STRATEGY_KIND();

        uint256 cap = alloc.capWanted;
        uint256 allocated = alloc.allocated;
        if (cap == allocated) return;

        if (cap > allocated) {
            uint256 diff = cap - allocated;
            if (IERC20(alloc.token).balanceOf(address(this)) < diff) revert VAULT__INSUFFICIENT_IDLE_BALANCE();

            IERC20(alloc.token).forceApprove(alloc.strategy, diff);
            uint256 out = ISingleAssetStrategy(alloc.strategy).deposit(alloc.token, diff);
            IERC20(alloc.token).forceApprove(alloc.strategy, 0);

            alloc.allocated += out;
        } else {
            uint256 diff = allocated - cap;
            uint256 withdrawn = ISingleAssetStrategy(alloc.strategy).withdraw(alloc.token, diff);
            alloc.allocated -= withdrawn;
        }

        emit SingleAllocationExecuted(key, alloc.allocated);
    }

    /**
     * @dev Executes pair asset allocation by depositing to or withdrawing from a strategy
     * @param key The unique identifier for the pair allocation
     */
    function executeAllocPair(bytes32 key) external onlyManager nonReentrant {
        PairAllocation storage alloc = pairAllocs[key];

        if (!alloc.exists) revert VAULT__ALLOCATION_NOT_FOUND();

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(alloc.strategy);
        if (!active) revert VAULT__STRATEGY_NOT_ACTIVE();
        if (kind != StrategyKind.PairAsset) revert VAULT__INVALID_STRATEGY_KIND();

        uint256 wantA = alloc.capWantedA;
        uint256 wantB = alloc.capWantedB;
        uint256 allocA = alloc.allocatedA;
        uint256 allocB = alloc.allocatedB;

        if (wantA == allocA && wantB == allocB) return;

        if (wantA > allocA || wantB > allocB) {
            _handleDeposit(alloc, wantA, wantB, allocA, allocB);
        }

        if (wantA < allocA || wantB < allocB) {
            _handleWithdrawal(alloc, wantA, wantB, allocA, allocB);
        }

        emit PairAllocationExecuted(key, alloc.allocatedA, alloc.allocatedB, wantA, wantB);
    }

    /**
     * @dev Internal function to handle deposits to pair asset strategy
     * @param alloc Storage reference to the pair allocation
     * @param wantA Target amount for token A
     * @param wantB Target amount for token B
     * @param allocA Current allocated amount for token A
     * @param allocB Current allocated amount for token B
     */
    function _handleDeposit(PairAllocation storage alloc, uint256 wantA, uint256 wantB, uint256 allocA, uint256 allocB) private {
        uint256 diffA = wantA > allocA ? wantA - allocA : 0;
        uint256 diffB = wantB > allocB ? wantB - allocB : 0;

        if (diffA > 0) {
            uint256 balanceA = IERC20(alloc.tokenA).balanceOf(address(this));
            if (balanceA < diffA) revert VAULT__INSUFFICIENT_IDLE_BALANCE();
            IERC20(alloc.tokenA).forceApprove(alloc.strategy, diffA);
        }

        if (diffB > 0) {
            uint256 balanceB = IERC20(alloc.tokenB).balanceOf(address(this));
            if (balanceB < diffB) revert VAULT__INSUFFICIENT_IDLE_BALANCE();
            IERC20(alloc.tokenB).forceApprove(alloc.strategy, diffB);
        }

        (uint256 outA, uint256 outB) = IPairAssetStrategy(alloc.strategy).deposit(alloc.tokenA, diffA, alloc.tokenB, diffB);

        if (diffA > 0 && outA == 0) revert VAULT__DEPOSIT_FAILED();
        if (diffB > 0 && outB == 0) revert VAULT__DEPOSIT_FAILED();
        if (outA > diffA || outB > diffB) revert VAULT__INVALID_DEPOSIT_AMOUNT();

        if (diffA > 0) IERC20(alloc.tokenA).forceApprove(alloc.strategy, 0);
        if (diffB > 0) IERC20(alloc.tokenB).forceApprove(alloc.strategy, 0);

        alloc.allocatedA += outA;
        alloc.allocatedB += outB;
    }

    /**
     * @dev Internal function to handle withdrawals from pair asset strategy
     * @param alloc Storage reference to the pair allocation
     * @param wantA Target amount for token A
     * @param wantB Target amount for token B
     * @param allocA Current allocated amount for token A
     * @param allocB Current allocated amount for token B
     */
    function _handleWithdrawal(PairAllocation storage alloc, uint256 wantA, uint256 wantB, uint256 allocA, uint256 allocB) private {
        uint256 diffA = wantA < allocA ? allocA - wantA : 0;
        uint256 diffB = wantB < allocB ? allocB - wantB : 0;

        (uint256 outA, uint256 outB) = IPairAssetStrategy(alloc.strategy).withdrawByAmounts(alloc.tokenA, diffA, alloc.tokenB, diffB);

        outA = outA > alloc.allocatedA ? alloc.allocatedA : outA;
        outB = outB > alloc.allocatedB ? alloc.allocatedB : outB;

        alloc.allocatedA -= outA;
        alloc.allocatedB -= outB;

        if (diffA > 0 && outA == 0) revert VAULT__WITHDRAWAL_FAILED();
        if (diffB > 0 && outB == 0) revert VAULT__WITHDRAWAL_FAILED();
    }

    /* ===================== Management ===================== */

    /**
     * @dev Adds or updates a single asset allocation
     * @param token Address of the token to allocate
     * @param cap Target allocation amount
     * @param stra Address of the strategy contract
     */
    function addSingleAllocation(address token, uint256 cap, address stra) external onlyManager {
        if (token == address(0)) revert VAULT__ZERO_ADDRESS();

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(stra);
        if (!active) revert VAULT__STRATEGY_NOT_ACTIVE();
        if (kind != StrategyKind.SingleAsset) revert VAULT__INVALID_STRATEGY_KIND();

        bytes32 key = _singleKey(stra, token);
        SingleAllocation storage alloc = singleAllocs[key];

        if (alloc.exists) {
            alloc.capWanted = cap;
        } else {
            singleAllocs[key] = SingleAllocation(stra, token, 0, cap, true);
            singleKeys.push(key);
            withdrawPriority.push(WithdrawPriority(StrategyKind.SingleAsset, key));
        }

        emit SingleAllocationSet(key, stra, cap);
    }

    /**
     * @dev Adds or updates a pair asset allocation
     * @param tokenA Address of the first token
     * @param tokenB Address of the second token
     * @param capA Target allocation amount for token A
     * @param capB Target allocation amount for token B
     * @param stra Address of the strategy contract
     */
    function addPairAllocation(address tokenA, address tokenB, uint256 capA, uint256 capB, address stra) external onlyManager {
        if (tokenA == address(0) || tokenB == address(0)) revert VAULT__ZERO_ADDRESS();

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(stra);
        if (!active) revert VAULT__STRATEGY_NOT_ACTIVE();
        if (kind != StrategyKind.PairAsset) revert VAULT__INVALID_STRATEGY_KIND();

        bytes32 key = _pairKey(stra, tokenA, tokenB);
        PairAllocation storage alloc = pairAllocs[key];

        if (alloc.exists) {
            if (tokenA < tokenB) {
                alloc.capWantedA = capA;
                alloc.capWantedB = capB;
            } else {
                alloc.capWantedA = capB;
                alloc.capWantedB = capA;
            }
        } else {
            (address a, address b, uint256 cA, uint256 cB) = tokenA < tokenB ? (tokenA, tokenB, capA, capB) : (tokenB, tokenA, capB, capA);
            pairAllocs[key] = PairAllocation(stra, a, b, 0, 0, cA, cB, true);
            pairKeys.push(key);
            withdrawPriority.push(WithdrawPriority(StrategyKind.PairAsset, key));
        }
        emit PairAllocationSet(key, stra, capA, capB);
    }

    /**
     * @dev Sets the withdrawal priority queue
     * @param queue Array of WithdrawPriority structs defining the withdrawal order
     */
    function setWithdrawPriority(WithdrawPriority[] calldata queue) external onlyManager {
        delete withdrawPriority;
        for (uint256 i; i < queue.length; ) {
            bytes32 allocKey = queue[i].allocKey;
            StrategyKind kind = queue[i].kind;

            if (kind == StrategyKind.SingleAsset) {
                if (!singleAllocs[allocKey].exists) revert VAULT__INVALID_STRATEGY_KIND();
            } else if (kind == StrategyKind.PairAsset) {
                if (!pairAllocs[allocKey].exists) revert VAULT__INVALID_STRATEGY_KIND();
            } else {
                revert VAULT__INVALID_STRATEGY_KIND();
            }

            withdrawPriority.push(queue[i]);
            unchecked {
                ++i;
            }
        }

        emit WithdrawPrioritySet(queue);
    }

    /**
     * @dev Withdraws all assets from a single asset allocation
     * @param key Unique identifier of the single allocation
     */
    function withdrawSingleAll(bytes32 key) external onlyManager {
        SingleAllocation storage alloc = singleAllocs[key];
        if (!alloc.exists) revert VAULT__ALLOCATION_NOT_FOUND();

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(alloc.strategy);
        if (!active) revert VAULT__STRATEGY_NOT_ACTIVE();
        if (kind != StrategyKind.SingleAsset) revert VAULT__INVALID_STRATEGY_KIND();

        ISingleAssetStrategy(alloc.strategy).withdrawAll(alloc.token);

        alloc.allocated = 0;
    }

    /**
     * @dev Withdraws all assets from a pair asset allocation
     * @param key Unique identifier of the pair allocation
     */
    function withdrawPairAll(bytes32 key) external onlyManager {
        PairAllocation storage alloc = pairAllocs[key];
        if (!alloc.exists) revert VAULT__ALLOCATION_NOT_FOUND();

        (StrategyKind kind, bool active) = IStrategyRegistry(strategyRegistry).strategies(alloc.strategy);
        if (!active) revert VAULT__STRATEGY_NOT_ACTIVE();
        if (kind != StrategyKind.PairAsset) revert VAULT__INVALID_STRATEGY_KIND();

        IPairAssetStrategy(alloc.strategy).withdrawAll(alloc.tokenA, alloc.tokenB);

        alloc.allocatedA = 0;
        alloc.allocatedB = 0;
    }

    /**
     * @dev Updates role assignment for a user
     * @param user Address of the user
     * @param role Role identifier
     * @param grant True to grant role, false to revoke
     */
    function updateRole(address user, bytes32 role, bool grant) external onlyAdmin {
        if (user == address(0)) revert VAULT__ZERO_ADDRESS();
        if (grant) _grantRole(role, user);
        else _revokeRole(role, user);
    }

    /**
     * @dev Updates the treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyAdmin {
        if (_treasury == address(0)) revert VAULT__ZERO_ADDRESS();
        treasury = _treasury;

        emit TreasurySet(_treasury);
    }

    /**
     * @dev Top token for IL
     * @param token Address to topup IL
     * @param amount amount topup
     */
    function topUpIL(address token, uint256 amount) external onlyManager {
        if (amount == 0) revert VAULT__ZERO_AMOUNT();
        if (token == address(0)) revert VAULT__ZERO_ADDRESS();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        topup[token] += amount;
        emit Deposited(token, amount, msg.sender);
    }

    /*---------- HARVEST ----------*/

    /**
     * @dev Harvests rewards from all active allocations
     */
    function harvest() external onlyManager nonReentrant {
        for (uint256 i; i < singleKeys.length; ) {
            SingleAllocation storage alloc = singleAllocs[singleKeys[i]];
            if (alloc.exists)
                try ISingleAssetStrategy(alloc.strategy).harvest(alloc.token) {
                    // Success
                } catch (bytes memory reason) {
                    emit HarvestFailed(singleKeys[i], reason);
                }
            unchecked {
                ++i;
            }
        }

        for (uint256 i; i < pairKeys.length; ) {
            PairAllocation storage alloc = pairAllocs[pairKeys[i]];
            if (alloc.exists)
                try IPairAssetStrategy(alloc.strategy).harvest(alloc.tokenA, alloc.tokenB) {
                    //success
                } catch (bytes memory reason) {
                    emit HarvestFailed(pairKeys[i], reason);
                }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Harvests rewards from a specific single asset allocation
     * @param key Unique identifier of the single allocation
     * @return rewardTokens Array of reward token addresses
     * @return amounts Array of reward amounts
     */
    function harvestSingleAllocation(bytes32 key) external onlyManager nonReentrant returns (address[] memory rewardTokens, uint256[] memory amounts) {
        SingleAllocation storage alloc = singleAllocs[key];

        if (!alloc.exists) revert VAULT__ALLOCATION_NOT_FOUND();

        (rewardTokens, amounts) = ISingleAssetStrategy(alloc.strategy).harvest(alloc.token);
        emit Harvest(key, rewardTokens, amounts);
    }

    /**
     * @dev Harvests rewards from a specific pair asset allocation
     * @param key Unique identifier of the pair allocation
     * @return rewardTokens Array of reward token addresses
     * @return amounts Array of reward amounts
     */
    function harvestPairAllocation(bytes32 key) external onlyManager nonReentrant returns (address[] memory rewardTokens, uint256[] memory amounts) {
        PairAllocation storage alloc = pairAllocs[key];

        if (!alloc.exists) revert VAULT__ALLOCATION_NOT_FOUND();

        (rewardTokens, amounts) = IPairAssetStrategy(alloc.strategy).harvest(alloc.tokenA, alloc.tokenB);
        emit Harvest(key, rewardTokens, amounts);
    }

    function swap(SwapParams calldata params) external onlyManager nonReentrant {
        if (params.tokenIn == address(0) || params.tokenOut == address(0)) revert VAULT__ZERO_ADDRESS();
        if (params.to == address(0)) revert VAULT__INVALID_SWAP_ADDRESS();
        if (params.value > 0 && address(this).balance < params.value) revert VAULT__INSUFFICIENT_FUNDS();
        if (params.amountIn == 0 || params.minAmountOut == 0) revert VAULT__ZERO_AMOUNT();

        require(bytes4(params.data) == KX_SWAP_SELECTOR, "KX: bad selector");
        bytes memory payload = params.data[4:];
        (, KxOutput memory output, , ) = abi.decode(payload, (KxInput, KxOutput, KxSwapData, KxFee));
        require(output.receiver == address(this), "Bad receiver");
        require(output.token == params.tokenOut, "Bad token output");
        require(output.minAmountOut >= params.minAmountOut, "Bad min amount out");

        uint256 bal = IERC20(params.tokenIn).balanceOf(address(this));
        if (bal < params.amountIn) revert VAULT__INSUFFICIENT_FUNDS();
        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(address(this));

        IERC20(params.tokenIn).forceApprove(params.to, params.amountIn);
        if (!_checkSwapExists(params.tokenIn, params.tokenOut)) {
            swapped[params.tokenIn].push(params.tokenOut);
        }
        (bool ok, bytes memory res) = params.to.call{value: params.value}(params.data);
        IERC20(params.tokenIn).forceApprove(params.to, 0);

        uint256 balanceAfter = IERC20(params.tokenOut).balanceOf(address(this));
        require(balanceAfter >= balanceBefore, "Balance decreased");
        uint256 amountOut = balanceAfter - balanceBefore;
        require(amountOut >= params.minAmountOut, "Insufficient output amount");

        if (!ok)
            assembly {
                revert(add(res, 32), mload(res))
            }
    }

    function _checkSwapExists(address fromToken, address toToken) internal view returns (bool exists) {
        for (uint256 i = 0; i < swapped[fromToken].length; i++) {
            if (swapped[fromToken][i] == toToken) {
                exists = true;
                break;
            }
        }
    }

    /* ===================== Views ===================== */

    /**
     * @dev Returns all single allocation keys
     * @return Array of bytes32 keys
     */
    function getAllSingleKeys() external view returns (bytes32[] memory) {
        return singleKeys;
    }

    /**
     * @dev Returns all tokens swapped by token
     * @param token token address
     * @return Array of address tokens
     */
    function getSwappedTokens(address token) external view returns (address[] memory) {
        return swapped[token];
    }

    /**
     * @dev Returns all pair allocation keys
     * @return Array of bytes32 keys
     */
    function getAllPairKeys() external view returns (bytes32[] memory) {
        return pairKeys;
    }

    /**
     * @dev Returns the current withdrawal priority queue
     * @return result Array of WithdrawPriority structs
     */
    function getWithdrawPriority() external view returns (WithdrawPriority[] memory result) {
        uint256 len = withdrawPriority.length;
        result = new WithdrawPriority[](len);
        for (uint256 i; i < len; ) {
            result[i] = withdrawPriority[i];
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Returns all single asset allocations
     * @return result Array of SingleAllocation structs
     */
    function getAllSingleAllocs() external view returns (SingleAllocation[] memory result) {
        uint256 len = singleKeys.length;
        result = new SingleAllocation[](len);
        for (uint256 i; i < len; ) {
            result[i] = singleAllocs[singleKeys[i]];
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Returns all pair asset allocations
     * @return result Array of PairAllocation structs
     */
    function getAllPairAllocs() external view returns (PairAllocation[] memory result) {
        uint256 len = pairKeys.length;
        result = new PairAllocation[](len);
        for (uint256 i; i < len; ) {
            result[i] = pairAllocs[pairKeys[i]];
            unchecked {
                ++i;
            }
        }
    }
}
