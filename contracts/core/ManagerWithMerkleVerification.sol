// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Auth, Authority} from "solmate/src/auth/Auth.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {MerkleProofLib} from "solmate/src/utils/MerkleProofLib.sol";
import {BoringVault} from "./BoringVault.sol";
import {IPausable} from "../interfaces/IPausable.sol";

import "../auth/PrimeAuth.sol";

/**
 * @title ManagerWithMerkleVerification
 * @author Prime Vaults
 * @notice Manages BoringVault operations with Merkle tree verification
 * @dev Each strategist can have their own Merkle root defining allowed operations
 *      Merkle tree leaves are: keccak256(abi.encodePacked(decoderAndSanitizer, target, valueIsNonZero, selector, argumentAddresses...))
 */
contract ManagerWithMerkleVerification is PrimeAuth, IPausable {
    using FixedPointMathLib for uint256;
    using Address for address;

    // ========================================= STATE =========================================

    /**
     * @notice The BoringVault this contract manages
     */
    BoringVault public immutable vault;

    /**
     * @notice Merkle root for each strategist defining their allowed operations
     * @dev Maps strategist address => merkle root
     */
    mapping(address => bytes32) public manageRoot;

    /**
     * @notice Pauses manageVaultWithMerkleVerification calls
     */
    bool public isPaused;

    // ========================================= EVENTS =========================================

    event ManageRootUpdated(address indexed strategist, bytes32 oldRoot, bytes32 newRoot);
    event BoringVaultManaged(uint256 callsMade);
    event Paused();
    event Unpaused();

    // ========================================= ERRORS =========================================

    error ManagerWithMerkleVerification__InvalidManageProofLength();
    error ManagerWithMerkleVerification__InvalidTargetDataLength();
    error ManagerWithMerkleVerification__InvalidValuesLength();
    error ManagerWithMerkleVerification__InvalidDecodersAndSanitizersLength();
    error ManagerWithMerkleVerification__FailedToVerifyManageProof(address target, bytes targetData, uint256 value);
    error ManagerWithMerkleVerification__Paused();
    error ManagerWithMerkleVerification__TotalSupplyMustRemainConstant();

    // ========================================= CONSTRUCTOR =========================================

    constructor(
        address _primeRBAC,
        address _vault
    ) PrimeAuth(_primeRBAC, address(BoringVault(payable(_vault)).authority())) {
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

    /**
     * @notice Pause manageVaultWithMerkleVerification calls
     * @dev Callable by EMERGENCY_ADMIN_ROLE
     */
    function pause() external onlyEmergencyAdmin {
        isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause manageVaultWithMerkleVerification calls
     * @dev Callable by EMERGENCY_ADMIN_ROLE
     */
    function unpause() external onlyEmergencyAdmin {
        isPaused = false;
        emit Unpaused();
    }

    // ========================================= STRATEGIST FUNCTIONS =========================================

    /**
     * @notice Allows strategist to manage the BoringVault with Merkle verification
     * @param manageProofs Array of Merkle proofs for each operation
     * @param decodersAndSanitizers Array of decoder contract addresses
     * @param targets Array of target contract addresses
     * @param targetData Array of calldata for each target
     * @param values Array of ETH values for each call
     * @dev Callable by STRATEGIST_ROLE
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
            _verifyCallData(
                strategistManageRoot,
                manageProofs[i],
                decodersAndSanitizers[i],
                targets[i],
                values[i],
                targetData[i]
            );
            vault.manage(targets[i], targetData[i], values[i]);
        }

        // Ensure total supply hasn't changed (prevents minting/burning during management)
        if (totalSupply != vault.totalSupply()) {
            revert ManagerWithMerkleVerification__TotalSupplyMustRemainConstant();
        }

        emit BoringVaultManaged(targetsLength);
    }

    // ========================================= INTERNAL FUNCTIONS =========================================

    /**
     * @notice Verifies a single manage call against the Merkle root
     * @param currentManageRoot The strategist's Merkle root
     * @param manageProof Merkle proof for this operation
     * @param decoderAndSanitizer Decoder contract address
     * @param target Target contract address
     * @param value ETH value to send
     * @param targetData Calldata for the target
     */
    function _verifyCallData(
        bytes32 currentManageRoot,
        bytes32[] calldata manageProof,
        address decoderAndSanitizer,
        address target,
        uint256 value,
        bytes calldata targetData
    ) internal view {
        // Extract function selector
        bytes4 selector = bytes4(targetData);

        // Get packed argument addresses from decoder
        bytes memory packedArgumentAddresses = abi.decode(decoderAndSanitizer.functionStaticCall(targetData), (bytes));

        if (
            !_verifyManageProof(
                currentManageRoot,
                manageProof,
                target,
                decoderAndSanitizer,
                value,
                selector,
                packedArgumentAddresses
            )
        ) {
            revert ManagerWithMerkleVerification__FailedToVerifyManageProof(target, targetData, value);
        }
    }

    /**
     * @notice Verifies a Merkle proof
     * @param root Merkle root
     * @param proof Merkle proof
     * @param target Target contract address
     * @param decoderAndSanitizer Decoder contract address
     * @param value ETH value
     * @param selector Function selector
     * @param packedArgumentAddresses Packed address arguments
     * @return bool True if proof is valid
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
        bytes32 leaf = keccak256(
            abi.encodePacked(decoderAndSanitizer, target, valueNonZero, selector, packedArgumentAddresses)
        );
        return MerkleProofLib.verify(proof, root, leaf);
    }
}
