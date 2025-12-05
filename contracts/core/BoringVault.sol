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

    // ========================================= STATE =========================================

    /**
     * @notice The underlying asset token for this vault
     */
    ERC20 public immutable asset;

    /**
     * @notice Contract responsible for implementing `beforeUpdate`.
     */
    IBeforeUpdateHook public beforeUpdateHook;

    //============================== EVENTS ===============================

    event Enter(address indexed from, address indexed asset, uint256 amount, address indexed to, uint256 shares);
    event Exit(address indexed to, address indexed asset, uint256 amount, address indexed from, uint256 shares);

    //============================== ERRORS ===============================

    error BoringVault__InvalidAsset();

    //============================== CONSTRUCTOR ===============================

    constructor(
        address _primeRBAC,
        address _authority,
        string memory _name,
        string memory _symbol,
        address _asset
    ) ERC20(_name, _symbol, ERC20(_asset).decimals()) PrimeAuth(_primeRBAC, _authority) {
        asset = ERC20(_asset);
    }

    //============================== MANAGE ===============================

    /**
     * @notice Allows manager to make an arbitrary function call from this contract.
     * @dev Callable by MANAGER_ROLE.
     */
    function manage(address target, bytes calldata data, uint256 value) external requiresAuth returns (bytes memory result) {
        result = target.functionCallWithValue(data, value);
    }

    /**
     * @notice Allows manager to make arbitrary function calls from this contract.
     * @dev Callable by MANAGER_ROLE.
     */
    function bulkManage(address[] calldata targets, bytes[] calldata data, uint256[] calldata values) external requiresAuth returns (bytes[] memory results) {
        uint256 targetsLength = targets.length;
        results = new bytes[](targetsLength);
        for (uint256 i; i < targetsLength; ++i) {
            results[i] = targets[i].functionCallWithValue(data[i], values[i]);
        }
    }

    //============================== ENTER ===============================

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

    //============================== EXIT ===============================

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

    //============================== BEFORE UPDATE HOOK ===============================

    /**
     * @notice Sets the before update hook (e.g., Distributor).
     * @notice If set to zero address, the hook is disabled.
     * @dev Callable by PROTOCOL_ADMIN_ROLE.
     */
    function setBeforeUpdateHook(address _hook) external onlyProtocolAdmin {
        beforeUpdateHook = IBeforeUpdateHook(_hook);
    }

    /**
     * @notice Call `beforeUpdate` hook BEFORE balance changes.
     */
    function _callBeforeUpdate(address from, address to, uint256 amount, address operator) internal {
        if (address(beforeUpdateHook) != address(0)) beforeUpdateHook.beforeUpdate(from, to, amount, operator);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _callBeforeUpdate(msg.sender, to, amount, msg.sender);
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _callBeforeUpdate(from, to, amount, msg.sender);
        return super.transferFrom(from, to, amount);
    }

    //============================== RECEIVE ===============================

    receive() external payable {}
}
