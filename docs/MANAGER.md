# ManagerWithMerkleVerification - Strategy Execution Gateway

## Purpose

**ManagerWithMerkleVerification** is the **strategy execution gateway** that allows strategists to deploy vault assets into DeFi protocols. This contract uses
**Merkle tree verification** to ensure every call has been pre-approved by admin.

## Role in Ecosystem

Manager serves as the **security intermediary**:

- **Strategy router**: Allows strategists to interact with DeFi protocols (Aave, Uniswap, Lido, etc.)
- **Permission enforcer**: Verifies every call via Merkle proof before execution
- **Whitelist manager**: Only allows pre-approved function calls
- **Safety checker**: Ensures total supply doesn't change after each operation

## Core Functions

### 1. Manage Vault with Merkle Verification

```solidity
function manageVaultWithMerkleVerification(
    bytes32[][] calldata manageProofs,
    address[] calldata decodersAndSanitizers,
    address[] calldata targets,
    bytes[] calldata targetData,
    uint256[] calldata values
) external requiresAuth
```

**Flow**:

1. Check contract not paused
2. Validate all arrays have same length
3. Get strategist's `manageRoot` (msg.sender)
4. Store `totalSupply` before execution
5. For each call:
   - Decode addresses from calldata via decoder
   - Verify Merkle proof
   - Execute call via `vault.manage()`
6. Check `totalSupply` hasn't changed after all calls
7. Emit event

### 2. Set Manage Root (Admin Only)

```solidity
function setManageRoot(address strategist, bytes32 _manageRoot)
    external onlyProtocolAdmin
```

- Updates Merkle root for strategist
- Each strategist has their own root
- Root defines **whitelist** of allowed calls

## Merkle Tree Structure

### Leaf Format

```solidity
bytes32 leaf = keccak256(abi.encodePacked(
    decoderAndSanitizer,    // address: Contract decode arguments
    target,                 // address: Protocol contract to call
    valueNonZero,          // bool: ETH value > 0?
    selector,              // bytes4: Function selector
    packedArgumentAddresses // bytes: Packed address arguments
));
```

### Example Leaf Construction

**Scenario**: Approve Aave to spend USDC

```javascript
// Function: USDC.approve(address spender, uint256 amount)
// Target: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
// Selector: 0x095ea7b3 (approve)

leaf = keccak256(abi.encodePacked(
    0xDecoder123...,           // Decoder contract
    0xA0b86991...USDC,         // USDC contract
    false,                     // No ETH value
    0x095ea7b3,                // approve selector
    abi.encode(0xAave123...)   // Aave pool address
));
```

### Merkle Tree Example

```
                    Root
                   /    \
              H(L1,L2)  H(L3,L4)
              /    \      /    \
            L1    L2    L3    L4

L1 = USDC.approve(Aave)
L2 = USDC.approve(Compound)
L3 = Aave.deposit(USDC)
L4 = Aave.withdraw(USDC)
```

## Decoder & Sanitizer

### Purpose

- **Decoder**: Extract address arguments từ calldata
- **Sanitizer**: Validate arguments meet requirements

### Example Implementation

```solidity
contract USDCApproveDecoder {
  function decode(bytes calldata data) external pure returns (bytes memory) {
    // Extract spender address from approve(address,uint256)
    address spender = abi.decode(data[4:], (address));
    return abi.encodePacked(spender);
  }
}
```

## Roles & Permissions

| Role                      | Permission                                 | Use Case                        |
| ------------------------- | ------------------------------------------ | ------------------------------- |
| **STRATEGIST_ROLE**       | Call `manageVaultWithMerkleVerification()` | Execute investment strategies   |
| **MANAGER_INTERNAL_ROLE** | Call `manageVaultWithMerkleVerification()` | Internal automation             |
| **MICRO_MANAGER_ROLE**    | Call `manageVaultWithMerkleVerification()` | Tactical operations             |
| **PROTOCOL_ADMIN**        | `setManageRoot()`                          | Update whitelist for strategist |

## Contract Interactions

### 1. **BoringVault** (Strategy Execution)

```
Strategist → Manager.manageVaultWithMerkleVerification()
          → Verify Merkle proof
          → vault.manage(target, data, value)
          → target.call(data) with value
```

### 2. **DecoderAndSanitizer** (Argument Extraction)

```
Manager → decoder.decode(targetData)
       → Extract address arguments
       → Verify in Merkle proof
```

### 3. **DeFi Protocols** (via BoringVault)

```
vault.manage(aave, "deposit(USDC, 1000)", 0)
  → Aave.deposit(USDC, 1000)
  → USDC transferred from vault to Aave
```

## Safety Mechanisms

### 1. Total Supply Invariant

```solidity
uint256 totalSupply = vault.totalSupply();
// ... execute all calls ...
if (totalSupply != vault.totalSupply()) {
    revert ManagerWithMerkleVerification__TotalSupplyMustRemainConstant();
}
```

**Purpose**: Ensures no shares are minted/burned during management

### 2. Merkle Proof Verification

```solidity
bytes32 leaf = keccak256(abi.encodePacked(...));
if (!MerkleProofLib.verify(proof, root, leaf)) {
    revert ManagerWithMerkleVerification__FailedToVerifyManageProof();
}
```

**Purpose**: Every call must be in the whitelist

### 3. Pause Mechanism

```solidity
if (isPaused) revert ManagerWithMerkleVerification__Paused();
```

**Purpose**: Emergency stop all strategy operations

## Use Cases

### 1. Deposit to Aave

```javascript
// Merkle leaf: USDC.approve(Aave, uint256.max)
targets = [USDC_ADDRESS];
targetData = [USDC.approve.encode(AAVE_POOL, MAX_UINT)];
values = [0];
manageProofs = [proof1];

// Merkle leaf: Aave.deposit(USDC, amount, vault, 0)
targets.push(AAVE_POOL);
targetData.push(Aave.deposit.encode(USDC, 1000e6, VAULT, 0));
values.push(0);
manageProofs.push(proof2);
```

### 2. Swap on Uniswap

```javascript
// Merkle leaf: UniswapRouter.exactInput(params)
targets = [UNISWAP_ROUTER];
targetData = [
  Router.exactInput.encode({
    path: [USDC, WETH],
    recipient: VAULT,
    amountIn: 1000e6,
    amountOutMinimum: 0.5e18,
  }),
];
values = [0];
manageProofs = [proof1];
```

### 3. Claim Fees from Accountant

```javascript
// Merkle leaf: Accountant.claimFees()
targets = [ACCOUNTANT_ADDRESS];
targetData = [Accountant.claimFees.encode()];
values = [0];
manageProofs = [proof1];
```

## Merkle Root Generation (Off-chain)

```javascript
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

// Define allowed calls
const leaves = [
  ["0xDecoder1", "0xUSDC", false, "0x095ea7b3", "0xAave"],
  ["0xDecoder2", "0xAave", false, "0xe8eda9df", "0xUSDC"],
  // ... more leaves
];

// Generate tree
const tree = StandardMerkleTree.of(leaves, ["address", "address", "bool", "bytes4", "bytes"]);

// Get root
const root = tree.root; // Store this on-chain via setManageRoot()

// Get proof for specific leaf
const proof = tree.getProof(0); // For first leaf
```

## Deployment & Configuration Flow

```
1. Deploy ManagerWithMerkleVerification(primeRBAC, vault)
2. Generate Merkle tree off-chain with allowed calls
3. Call setManageRoot(strategist, root)
4. Grant STRATEGIST_ROLE to strategist address
5. Strategist can now execute whitelisted calls
```

## Technical Specifications

- **One root per strategist**: Each strategist has their own whitelist
- **Atomic execution**: All calls in batch must succeed
- **Gas optimization**: Batch multiple calls to save gas
- **Immutable vault**: Vault address cannot be changed

## Important Notes

1. **Merkle root must be updated first**: Strategist needs root to be set before execution
2. **Decoder must be accurate**: Wrong decoder = wrong address extraction = failed proof
3. **Total supply invariant critical**: Cannot mint/burn shares during management
4. **Proof generation off-chain**: Frontend must generate proof for each call
5. **Batch operations recommended**: Combine multiple calls to save gas
6. **Value transfers possible**: Can send ETH if valueNonZero=true in leaf
