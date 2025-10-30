// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IRewardsDistributor} from "../interface/IRewardsDistributor.sol";

contract BoringVault is ERC20, Ownable {
    // ========================================= STATE =========================================

    /**
     * @notice Contract responsbile for implementing `beforeUpdate`.
     */
    ERC20 public immutable asset;
    IRewardsDistributor public rewardsDistributor;

    //============================== EVENTS ===============================

    event Enter(address indexed from, address indexed asset, uint256 amount, address indexed to, uint256 shares);
    event Exit(address indexed to, address indexed asset, uint256 amount, address indexed from, uint256 shares);

    //============================== CONSTRUCTOR ===============================

    constructor(
        address _asset,
        address _owner,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol, _decimals) Ownable(_owner) {
        asset = ERC20(_asset);
    }

    //============================== ENTER ===============================

    /**
     * @notice Allows minter to mint shares, in exchange for assets.
     * @dev If assetAmount is zero, no assets are transferred in.
     * @dev Callable by MINTER_ROLE.
     */
    function enter(address from, uint256 assetAmount, address to, uint256 shareAmount) external onlyOwner {
        // Transfer assets in
        if (assetAmount > 0) asset.safeTransferFrom(from, address(this), assetAmount);

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
    function exit(address to, uint256 assetAmount, address from, uint256 shareAmount) external onlyOwner {
        // Burn shares.
        _burn(from, shareAmount);

        // Transfer assets out.
        if (assetAmount > 0) asset.safeTransfer(to, assetAmount);

        emit Exit(to, address(asset), assetAmount, from, shareAmount);
    }

    //============================== BEFORE UPDATE HOOK ===============================
    function _update(address from, address to, uint256 amount) internal virtual override {
        rewardsDistributor.beforeUpdate(from, to, amount);
        super._update(from, to, amount);
        rewardsDistributor.afterUpdate(from, to, amount);
    }

    //============================== RECEIVE ===============================
    receive() external payable {}
}
