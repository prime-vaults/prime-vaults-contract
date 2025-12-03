// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IManagerErrors {
    error ManagerWithMerkleVerification__InvalidManageProofLength();
    error ManagerWithMerkleVerification__InvalidTargetDataLength();
    error ManagerWithMerkleVerification__InvalidValuesLength();
    error ManagerWithMerkleVerification__InvalidDecodersAndSanitizersLength();
    error ManagerWithMerkleVerification__FailedToVerifyManageProof(address target, bytes targetData, uint256 value);
    error ManagerWithMerkleVerification__Paused();
    error ManagerWithMerkleVerification__TotalSupplyMustRemainConstant();
}
