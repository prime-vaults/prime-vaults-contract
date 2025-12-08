// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Auth, Authority} from "solmate/src/auth/Auth.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {MerkleProofLib} from "solmate/src/utils/MerkleProofLib.sol";
import {BoringVault} from "./BoringVault.sol";
import {IManager} from "../interfaces/IManager.sol";

import "../auth/PrimeAuth.sol";

contract ManagerWithMerkleVerification is PrimeAuth, IManager {
    using FixedPointMathLib for uint256;
    using Address for address;

    // ========================================= STATE =========================================

    /**
     * @notice The BoringVault this contract manages
     */
    BoringVault public immutable vault;

    /**
     * @notice A merkle tree root that restricts what data can be passed to the BoringVault.
     * @dev Maps a strategist address to their specific merkle root.
     * @dev Each leaf is composed of the keccak256 hash of abi.encodePacked {decodersAndSanitizer, target, valueIsNonZero, selector, argumentAddress_0, ...., argumentAddress_N}
     *      Where:
     *             - decodersAndSanitizer is the addres to call to extract packed address arguments from the calldata
     *             - target is the address to make the call to
     *             - valueIsNonZero is a bool indicating whether or not the value is non-zero
     *             - selector is the function selector on target
     *             - argumentAddress is each allowed address argument in that call
     */
    mapping(address => bytes32) public manageRoot;

    // ========================================= CONSTRUCTOR =========================================

    constructor(address _primeRBAC, address _vault) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
        vault = BoringVault(payable(_vault));
    }

    // ========================================= ADMIN FUNCTIONS =========================================

    /**
     * @notice Sets the Merkle root for a strategist
     * @param strategist Address of the strategist
     * @param _manageRoot The new Merkle root
     * @dev Callable by ADMIN_ROLE
     */
    function setManageRoot(address strategist, bytes32 _manageRoot) external onlyProtocolAdmin {
        bytes32 oldRoot = manageRoot[strategist];
        manageRoot[strategist] = _manageRoot;
        emit ManageRootUpdated(strategist, oldRoot, _manageRoot);
    }

    // ========================================= STRATEGIST FUNCTIONS =========================================

    /**
     * @notice Allows strategist to manage the BoringVault.
     * @dev The strategist must provide a merkle proof for every call that verifiees they are allowed to make that call.
     * @dev Callable by MANAGER_INTERNAL_ROLE.
     * @dev Callable by STRATEGIST_ROLE.
     * @dev Callable by MICRO_MANAGER_ROLE.
     */
    function manageVaultWithMerkleVerification(
        bytes32[][] calldata manageProofs,
        address[] calldata decodersAndSanitizers,
        address[] calldata targets,
        bytes[] calldata targetData,
        uint256[] calldata values
    ) external requiresAuth {
        if (isPaused) revert ManagerWithMerkleVerification__Paused();
        uint256 targetsLength = targets.length;
        if (targetsLength != manageProofs.length) revert ManagerWithMerkleVerification__InvalidManageProofLength();
        if (targetsLength != targetData.length) revert ManagerWithMerkleVerification__InvalidTargetDataLength();
        if (targetsLength != values.length) revert ManagerWithMerkleVerification__InvalidValuesLength();
        if (targetsLength != decodersAndSanitizers.length) {
            revert ManagerWithMerkleVerification__InvalidDecodersAndSanitizersLength();
        }

        bytes32 strategistManageRoot = manageRoot[msg.sender];
        uint256 totalSupply = vault.totalSupply();

        for (uint256 i; i < targetsLength; ++i) {
            _verifyCallData(strategistManageRoot, manageProofs[i], decodersAndSanitizers[i], targets[i], values[i], targetData[i]);
            vault.manage(targets[i], targetData[i], values[i]);
        }
        if (totalSupply != vault.totalSupply()) {
            revert ManagerWithMerkleVerification__TotalSupplyMustRemainConstantDuringPlatform();
        }
        emit BoringVaultManaged(targetsLength);
    }

    // ========================================= INTERNAL FUNCTIONS =========================================

    /**
     * @notice Helper function to decode, sanitize, and verify call data.
     */
    function _verifyCallData(
        bytes32 currentManageRoot,
        bytes32[] calldata manageProof,
        address decoderAndSanitizer,
        address target,
        uint256 value,
        bytes calldata targetData
    ) internal view {
        // Use address decoder to get addresses in call data.
        bytes memory packedArgumentAddresses = abi.decode(decoderAndSanitizer.functionStaticCall(targetData), (bytes));
        if (!_verifyManageProof(currentManageRoot, manageProof, target, decoderAndSanitizer, value, bytes4(targetData), packedArgumentAddresses)) {
            revert ManagerWithMerkleVerification__FailedToVerifyManageProof(target, targetData, value);
        }
    }

    /**
     * @notice Helper function to verify a manageProof is valid.
     */
    function _verifyManageProof(
        bytes32 root,
        bytes32[] calldata proof,
        address target,
        address decoderAndSanitizer,
        uint256 value,
        bytes4 selector,
        bytes memory packedArgumentAddresses
    ) internal pure returns (bool) {
        bool valueNonZero = value > 0;
        bytes32 leaf = keccak256(abi.encodePacked(decoderAndSanitizer, target, valueNonZero, selector, packedArgumentAddresses));
        return MerkleProofLib.verify(proof, root, leaf);
    }
}
