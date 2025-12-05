// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IManager {
    /* ========================================= ERRORS ========================================= */
    error ManagerWithMerkleVerification__Paused();
    error ManagerWithMerkleVerification__InvalidManageProofLength();
    error ManagerWithMerkleVerification__InvalidTargetDataLength();
    error ManagerWithMerkleVerification__InvalidValuesLength();
    error ManagerWithMerkleVerification__InvalidDecodersAndSanitizersLength();
    error ManagerWithMerkleVerification__InvalidDecoderAndSanitizer();
    error ManagerWithMerkleVerification__InvalidTarget();
    error ManagerWithMerkleVerification__FailedToVerifyManageProof(address target, bytes targetData, uint256 value);
    error ManagerWithMerkleVerification__OnlyCallableByBoringVault();
    error ManagerWithMerkleVerification__TotalSupplyMustRemainConstant();
    error ManagerWithMerkleVerification__FlashLoanNotInProgress();

    /* ========================================= EVENTS ========================================= */
    event ManageRootUpdated(address indexed strategist, bytes32 oldRoot, bytes32 newRoot);
    event BoringVaultManaged(uint256 callsMade);
}
