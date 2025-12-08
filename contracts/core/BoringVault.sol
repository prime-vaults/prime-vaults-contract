// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {IBeforeUpdateHook} from "../interfaces/hooks/IBeforeUpdateHook.sol";

import {PrimeAuth} from "../auth/PrimeAuth.sol";

contract BoringVault is ERC20, PrimeAuth, ERC721Holder, ERC1155Holder {
    using Address for address;
    using SafeTransferLib for ERC20;

    /* ========================================= STATE ========================================= */

    /** @notice Underlying asset token (e.g., USDC, WETH) */
    ERC20 public immutable asset;

    /** @notice Optional hook called before balance changes (mint/burn/transfer) */
    IBeforeUpdateHook public beforeUpdateHook;

    /* ========================================= EVENTS ========================================= */

    event Enter(address indexed from, address indexed asset, uint256 amount, address indexed to, uint256 shares);
    event Exit(address indexed to, address indexed asset, uint256 amount, address indexed from, uint256 shares);

    /* ========================================= ERRORS ========================================= */

    error BoringVault__InvalidAsset();

    /* ========================================= CONSTRUCTOR ========================================= */

    /**
     * @notice Initialize vault with asset and access control
     * @param _primeRBAC PrimeRBAC contract for protocol-level roles
     * @param _authority RolesAuthority for vault-specific RBAC
     * @param _name Vault share token name
     * @param _symbol Vault share token symbol
     * @param _asset Underlying asset address
     */
    constructor(
        address _primeRBAC,
        address _authority,
        string memory _name,
        string memory _symbol,
        address _asset
    ) ERC20(_name, _symbol, ERC20(_asset).decimals()) PrimeAuth(_primeRBAC, _authority) {
        asset = ERC20(_asset);
    }

    /* ========================================= MANAGE ========================================= */

    /**
     * @notice Execute arbitrary call to DeFi protocols (e.g., Aave deposit, Uniswap swap)
     * @dev Restricted to MANAGER_ROLE. Must be validated by decoder/sanitizer
     * @param target Contract address to call
     * @param data Encoded function call
     * @param value ETH amount to send
     * @return result Return data from call
     */
    function manage(address target, bytes calldata data, uint256 value) external requiresAuth returns (bytes memory result) {
        result = target.functionCallWithValue(data, value);
    }

    /**
     * @notice Execute multiple calls atomically
     * @dev Restricted to MANAGER_ROLE. All calls must succeed or entire transaction reverts
     * @param targets Array of contract addresses
     * @param data Array of encoded function calls
     * @param values Array of ETH amounts
     * @return results Array of return data
     */
    function bulkManage(address[] calldata targets, bytes[] calldata data, uint256[] calldata values) external requiresAuth returns (bytes[] memory results) {
        uint256 targetsLength = targets.length;
        results = new bytes[](targetsLength);
        for (uint256 i; i < targetsLength; ++i) {
            results[i] = targets[i].functionCallWithValue(data[i], values[i]);
        }
    }

    /* ========================================= DEPOSIT ========================================= */

    /**
     * @notice Allows minter to mint shares, in exchange for assets.
     * @dev If assetAmount is zero, no assets are transferred in.
     * @dev Callable by MINTER_ROLE.
     */
    function enter(address from, uint256 assetAmount, address to, uint256 shareAmount) external requiresAuth {
        // Transfer assets in
        if (assetAmount > 0) asset.safeTransferFrom(from, address(this), assetAmount);

        // Update rewards BEFORE minting (with old balances)
        _callBeforeUpdate(address(0), to, shareAmount, msg.sender);

        // Mint shares.
        _mint(to, shareAmount);

        emit Enter(from, address(asset), assetAmount, to, shareAmount);
    }

    /* ========================================= WITHDRAWAL ========================================= */

    /**
     * @notice Allows burner to burn shares, in exchange for assets.
     * @dev If assetAmount is zero, no assets are transferred out.
     * @dev Callable by BURNER_ROLE.
     */
    function exit(address to, uint256 assetAmount, address from, uint256 shareAmount) external requiresAuth {
        // Update rewards BEFORE burning (with old balances)
        _callBeforeUpdate(from, address(0), shareAmount, msg.sender);

        // Burn shares.
        _burn(from, shareAmount);

        // Transfer assets out.
        if (assetAmount > 0) asset.safeTransfer(to, assetAmount);

        emit Exit(to, address(asset), assetAmount, from, shareAmount);
    }

    /* ========================================= HOOKS ========================================= */

    /**
     * @notice Configure hook called before balance changes (optional)
     * @dev Restricted to PROTOCOL_ADMIN_ROLE. Set to address(0) to disable
     * @dev Common use case: Distributor contract for reward tracking
     * @param _hook Address implementing IBeforeUpdateHook interface
     */
    function setBeforeUpdateHook(address _hook) external onlyOwner {
        beforeUpdateHook = IBeforeUpdateHook(_hook);
    }

    /**
     * @notice Internal: Invoke hook before balance changes (if configured)
     * @dev Hook failure causes transaction revert
     * @param from Source address (address(0) for minting)
     * @param to Destination address (address(0) for burning)
     * @param amount Share amount being transferred
     * @param operator Transaction initiator (msg.sender)
     */
    function _callBeforeUpdate(address from, address to, uint256 amount, address operator) internal {
        if (address(beforeUpdateHook) != address(0)) beforeUpdateHook.beforeUpdate(from, to, amount, operator);
    }

    /** @notice ERC20 transfer with hook call */
    function transfer(address to, uint256 amount) public override returns (bool) {
        _callBeforeUpdate(msg.sender, to, amount, msg.sender);
        return super.transfer(to, amount);
    }

    /** @notice ERC20 transferFrom with hook call */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _callBeforeUpdate(from, to, amount, msg.sender);
        return super.transferFrom(from, to, amount);
    }

    /* ========================================= RECEIVE ========================================= */

    /** @notice Accept ETH for gas refunds or native token strategies */
    receive() external payable {}
}
