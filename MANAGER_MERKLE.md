# Manager with Merkle Verification - Implementation Guide

## Overview

Implementation of a Vault management system with Merkle Tree verification, based on
[Boring Vault by Veda Labs](https://github.com/Veda-Labs/boring-vault).

This system allows strategists to execute vault operations (like `claimFees`) through cryptographic proof verification,
ensuring only pre-approved operations can be executed.

## Architecture

### Core Components

1. **ManagerWithMerkleVerification** (`contracts/core/ManagerWithMerkleVerification.sol`)
   - Manages BoringVault operations through Merkle tree verification
   - Each strategist has their own Merkle root defining allowed operations
   - Supports pause/unpause mechanism for emergency control
   - Uses Solmate's `MerkleProofLib` for secure proof verification

2. **BaseDecoderAndSanitizer** (`contracts/decodersAndSanitizers/BaseDecoderAndSanitizer.sol`)
   - Base decoder contract supporting common functions
   - Extracts address arguments from calldata
   - Supports: `approve`, `transfer`, `claimFees()`, `claimFees(address)`, `claimYield`, etc.

3. **FullDecoderAndSanitizer** (`contracts/decodersAndSanitizers/FullDecoderAndSanitizer.sol`)
   - Extended decoder with additional protocol-specific functions
   - Inherits from BaseDecoderAndSanitizer

4. **MerkleTreeHelper** (`contracts/helper/MerkleTreeHelper.sol`)
   - Utility library for generating and verifying Merkle trees in tests
   - Helper functions: `generateMerkleTree`, `getProof`, `verify`, `createLeaf`

## Workflow

### 1. Create Merkle Tree

Define allowed operations by creating leaves:

```typescript
import { concat, keccak256, toFunctionSelector } from "viem";

// For claimFees() with no parameters
const claimFeesSelector = toFunctionSelector("claimFees()");
const leaf = keccak256(
  concat([
    decoderAddress, // FullDecoderAndSanitizer address
    accountantAddress, // Target contract (AccountantWithYieldStreaming)
    "0x00", // valueNonZero = false (no ETH sent)
    claimFeesSelector, // Function selector
    // No packed addresses for claimFees()
  ]),
);

// For functions with parameters, add packed addresses
const feeAsset = "0x123...";
const claimFeesWithParamSelector = toFunctionSelector("claimFees(address)");
const leafWithParam = keccak256(
  concat([
    decoderAddress,
    accountantAddress,
    "0x00",
    claimFeesWithParamSelector,
    feeAsset, // Packed address argument
  ]),
);
```

### 2. Set Merkle Root

Admin grants permissions to strategist:

```typescript
// For single operation, use leaf as root
await manager.write.setManageRoot([strategistAddress, leaf]);

// For multiple operations, build tree and use root
const tree = generateMerkleTree([leaf1, leaf2, leaf3]);
const root = tree[tree.length - 1][0];
await manager.write.setManageRoot([strategistAddress, root]);
```

### 3. Execute Operations

Strategist executes pre-approved operations:

```typescript
import { encodeFunctionData } from "viem";

// Prepare calldata
const claimFeesCalldata = encodeFunctionData({
  abi: [
    {
      name: "claimFees",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [],
      outputs: [],
    },
  ],
  functionName: "claimFees",
  args: [],
});

// Execute with Merkle proof
await manager.write.manageVaultWithMerkleVerification([
  [[]], // Empty proof for single-leaf tree
  [decoderAddress], // Decoder contract
  [accountantAddress], // Target contract
  [claimFeesCalldata], // Function calldata
  [0n], // ETH value (0 for most operations)
]);
```

## Complete Example: ClaimFees

```typescript
import PrimeFactoryModule from "../ignition/modules/PrimeFactory.js";
import { network } from "hardhat";
import { concat, encodeFunctionData, keccak256, toFunctionSelector } from "viem";

async function claimFeesExample() {
  const { ignition, viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  // Deploy complete system
  const { manager, rawDataDecoder, accountant, vault, teller } = await ignition.deploy(PrimeFactoryModule);

  // Step 1: Create Merkle leaf
  const claimFeesSelector = toFunctionSelector("claimFees()");
  const leaf = keccak256(
    concat([
      rawDataDecoder.address as `0x${string}`,
      accountant.address as `0x${string}`,
      "0x00" as `0x${string}`,
      claimFeesSelector,
    ]),
  );

  // Step 2: Set Merkle root
  await manager.write.setManageRoot([deployer.account.address, leaf]);

  // Step 3: Prepare calldata
  const claimFeesCalldata = encodeFunctionData({
    abi: [
      {
        name: "claimFees",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
      },
    ],
    functionName: "claimFees",
    args: [],
  });

  // Step 4: Execute
  await manager.write.manageVaultWithMerkleVerification([
    [[]],
    [rawDataDecoder.address],
    [accountant.address],
    [claimFeesCalldata],
    [0n],
  ]);
}
```

## Role-Based Access Control

### Roles

- **ADMIN_ROLE (1)**: Can set Merkle roots, pause/unpause Manager
- **MANAGER_ROLE (2)**: Granted to Manager contract to call `vault.manage()`
- **STRATEGIST_ROLE (7)**: Can execute operations via `manageVaultWithMerkleVerification`

### Setup in Deployment

The `Manager.ts` module automatically sets up role capabilities:

```typescript
// STRATEGIST_ROLE can call manageVaultWithMerkleVerification
rolesAuthority.setRoleCapability(
  STRATEGIST_ROLE,
  manager,
  toFunctionSelector("manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])"),
  true,
);

// ADMIN_ROLE can call setManageRoot
rolesAuthority.setRoleCapability(ADMIN_ROLE, manager, toFunctionSelector("setManageRoot(address,bytes32)"), true);

// Grant MANAGER_ROLE to manager contract
rolesAuthority.setUserRole(manager, MANAGER_ROLE, true);

// Grant STRATEGIST_ROLE to admin (for testing)
rolesAuthority.setUserRole(adminAddress, STRATEGIST_ROLE, true);
```

## Security Features

1. **Merkle Proof Verification**: Every operation requires a valid Merkle proof using Solmate's battle-tested
   `MerkleProofLib`
2. **Role-Based Access Control**: Only authorized roles can execute operations
3. **Pause Mechanism**: Admin can pause the Manager in emergency situations
4. **Total Supply Check**: Ensures vault shares remain constant during operations
5. **Decoder Validation**: All calldata is validated through decoder contracts before execution

## Deployment

### Deploy Manager Module

```bash
# Deploy full system including Manager
pnpm hardhat ignition deploy ignition/modules/PrimeFactory.ts \
  --parameters ignition/parameters/localhost-usd.json \
  --network localhost
```

### Run Tests

```bash
# Test Manager with Merkle verification
pnpm test test/03_ClaimFees.ts
```

## Files Structure

### Contracts

- `contracts/core/ManagerWithMerkleVerification.sol` - Main Manager contract
- `contracts/decodersAndSanitizers/BaseDecoderAndSanitizer.sol` - Base decoder
- `contracts/decodersAndSanitizers/FullDecoderAndSanitizer.sol` - Extended decoder
- `contracts/decodersAndSanitizers/PrimeDecoderAndSanitizer.sol` - Prime-specific decoder
- `contracts/helper/MerkleTreeHelper.sol` - Test utility library

### Deployment Modules

- `ignition/modules/Manager.ts` - Manager deployment with RBAC setup
- `ignition/modules/PrimeFactory.ts` - Complete system deployment

### Tests

- `test/03_ClaimFees.ts` - Manager with Merkle verification test

## Key Differences from Boring Vault

1. **Decoder Naming**: Uses `FullDecoderAndSanitizer` instead of `RawDataDecoderAndSanitizer`
2. **Merkle Library**: Uses Solmate's `MerkleProofLib.verify()` instead of custom implementation
3. **Integration**: Integrated with PrimeFactory deployment for complete system setup
4. **Simplified Decoder**: `claimFees()` with no parameters is supported in BaseDecoderAndSanitizer

## References

- [Boring Vault - Veda Labs](https://github.com/Veda-Labs/boring-vault)
- [Merkle Tree Helper](https://github.com/Veda-Labs/boring-vault/tree/main/test/resources/MerkleTreeHelper)
- [Manager Implementation](https://github.com/Veda-Labs/boring-vault/blob/main/src/base/Roles/ManagerWithMerkleVerification.sol)
- [Solmate MerkleProofLib](https://github.com/transmissions11/solmate/blob/main/src/utils/MerkleProofLib.sol)

## Next Steps

1. ✅ Integrate with AccountantWithYieldStreaming deployment
2. ✅ Add `claimFees()` support to BaseDecoderAndSanitizer
3. ✅ Implement tests with actual execution
4. 🔄 Create scripts to generate Merkle trees for production
5. 🔄 Implement frontend for strategists to manage operations
6. 🔄 Add more sophisticated DecoderAndSanitizer contracts for specific protocols (Uniswap, Aave, etc.)
