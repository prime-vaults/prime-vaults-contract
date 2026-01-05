# Prime Bridge Executor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.30-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg)](https://hardhat.org/)

**Crosschain Bridge Execution Layer for Prime Vaults**

Prime Bridge Executor enables seamless crosschain deposits into Prime Vaults from any supported blockchain. By integrating LI.FI for EVM chains and Stargate for Core chain, users can bridge assets directly into their ERC-4337 Smart Accounts on the native chain (Berachain) with optional gas sponsorship.

## Deployed Contracts

| Chain | Contract | Address |
|-------|----------|---------|
| **Berachain** | PrimeExecutor | `0xf9e8D18003590E06334E8C70cE6dD0B480462ec5` |
| **Ethereum** | PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |
| **BNB Chain** | PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |
| **Arbitrum** | PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |
| **CoreDAO** | PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [How It Works](#how-it-works)
4. [Contract Documentation](#contract-documentation)
5. [Integration Guide](#integration-guide)
6. [Security Considerations](#security-considerations)
7. [Development Setup](#development-setup)
8. [Further Reading](#further-reading)

---

## System Overview

### What is Prime Bridge Executor?

Prime Bridge Executor is a **smart contract infrastructure** that enables users to:
- **Deposit into Prime Vaults from any chain** - Bridge assets seamlessly from supported blockchains
- **Leverage multi-protocol aggregation** - Use LI.FI (EVM chains) or Stargate (Core chain)
- **Receive in ERC-4337 Smart Accounts** - Assets land in your smart contract wallet on PrimeVaults chain
- **Benefit from gas sponsorship** - PrimeProtocol sponsors gas fees for Stargate users

### Key Problems Solved

| Problem | Solution |
|---------|----------|
| **Crosschain UX Complexity** | Single interface for multi-chain deposits |
| **High Gas Costs** | Optional gas sponsorship for Stargate users |
| **Bridge Security** | Automatic refunds on failure + reentrancy protection |
| **Protocol Integration** | Unified API across LI.FI and Stargate protocols |

### Use Case Example

```
User has 1000 USDC on Arbitrum → Wants to deposit into Prime Vaults (on Ethereum)

Traditional Flow:
1. Bridge USDC Arbitrum → Ethereum (manual)
2. Deploy Smart Account on Ethereum (manual)
3. Transfer USDC to Smart Account (manual)
4. Approve Prime Vaults (manual)
5. Deposit into vault (manual)

Prime Bridge Executor Flow:
1. Call LiFiBridgeExecutor.execute() on Arbitrum
   → Automatic bridge + Smart Account deposit ✓
   → Gas sponsored by PrimeProtocol (if using Stargate) ✓
```

---

## Architecture

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Prime Bridge Executor Flow                           │
│                                                                         │
│  User on Source Chain (Arbitrum, BSC, Core, etc.)                      │
│       │                                                                 │
│       │ 1. Approve token                                               │
│       │ 2. Call execute()                                              │
│       │                                                                 │
│       ├───► LiFiBridgeExecutor (for EVM Chains)                       │
│       │     └─► LiFi Diamond Contract (Multi-Protocol Aggregator)     │
│       │          └─► Underlying Bridge (Stargate, Across, etc.)       │
│       │                                                                │
│       └───► StargateBridgeExecutor (for Core Chain)                   │
│             ├─► execute() - User pays gas                             │
│             │    └─► Stargate Protocol                                │
│             │                                                          │
│             └─► executeSponsored() - PrimeProtocol pays gas ⭐        │
│                  └─► Stargate Protocol                                │
│                                                                        │
│       ▼                                                                │
│  Crosschain Bridge Transfer                                           │
│       │                                                                │
│       ▼                                                                │
│  Destination Chain (PrimeVaults Network)                              │
│       │                                                                │
│       └───► ERC-4337 Smart Account (User's Wallet)                   │
│             └─► Prime Vaults (Deposit & Earn Yield)                   │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Contract Hierarchy

```
BaseBridgeExecutor (Abstract Base Contract)
├─ State Variables
│  ├─ totalBridgedBySender (per-user tracking)
│  └─ totalBridged (global tracking)
│
├─ Core Features
│  ├─ _recordBridgeSuccess() - Update statistics
│  ├─ _handleBridgeFailure() - Automatic refunds
│  └─ emergencyWithdraw() - Admin safety
│
└─ Security
   ├─ Ownable (access control)
   └─ ReentrancyGuard (reentrancy protection)

├──► LiFiBridgeExecutor
│    ├─ Inherits: BaseBridgeExecutor + LiFiTxDataExtractor
│    │
│    ├─ State Variables
│    │  └─ lifiDiamond - LI.FI aggregator contract address
│    │
│    ├─ Core Functions
│    │  ├─ execute(bytes calldata data_) - Execute LI.FI bridge
│    │  └─ extractMainParameters() - Decode LI.FI calldata
│    │
│    └─ Supported Chains: All EVM (Arbitrum, BSC, Polygon, etc.)

└──► StargateBridgeExecutor
     ├─ Inherits: BaseBridgeExecutor + StargateTxDataExtractor
     │
     ├─ State Variables
     │  ├─ whitelist - Approved Stargate contract addresses
     │  ├─ maxFeeAllowed - Gas fee cap for sponsorship
     │  └─ totalSponsored - Total amount sponsored
     │
     ├─ Core Functions
     │  ├─ execute(to, data, token) - User pays gas
     │  ├─ executeSponsored(to, data, token) - Protocol pays gas ⭐
     │  ├─ addToWhitelist() - Admin: add bridge contract
     │  └─ depositFunds() - Admin: fund gas sponsorship
     │
     └─ Supported Chains: Core chain (primary use case)

Helper Contracts:
├─ LiFiTxDataExtractor
│  ├─ _extractBridgeData() - Decode ILiFi.BridgeData
│  └─ _extractSwapData() - Decode LibSwap.SwapData[]
│
└─ StargateTxDataExtractor
   └─ _extractSendData() - Decode SendParam + MessagingFee
```

---

## How It Works

### LiFi Flow (EVM Chains)

**Complete Execution Flow:**

```
┌────────────────────────────────────────────────────────────────────┐
│ Step 1: User Initiates Deposit from Arbitrum                       │
├────────────────────────────────────────────────────────────────────┤
│ Frontend calls LI.FI API:                                          │
│   GET /quote?fromChain=arbitrum&toChain=ethereum&...              │
│   → Returns: transaction data (calldata for execute())            │
└────────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────────┐
│ Step 2: User Approves Token                                       │
├────────────────────────────────────────────────────────────────────┤
│ USDC.approve(LiFiBridgeExecutor, 1000 USDC)                       │
└────────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────────┐
│ Step 3: User Calls execute()                                      │
├────────────────────────────────────────────────────────────────────┤
│ LiFiBridgeExecutor.execute(data_) with msg.value                 │
│   │                                                               │
│   ├─► Line 39: Extract parameters from calldata                  │
│   │    (sendingAssetId, receiver, amount) = extractMainParameters()│
│   │                                                               │
│   ├─► Line 44-46: Check native vs ERC20                          │
│   │    If native: require msg.value >= amount                    │
│   │                                                               │
│   ├─► Line 48: Transfer token from user → contract               │
│   │    SafeERC20.safeTransferFrom(token, user, contract, amount) │
│   │                                                               │
│   └─► Line 50: Approve LiFi Diamond                              │
│        SafeERC20.forceApprove(token, lifiDiamond, amount)        │
└────────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────────┐
│ Step 4: Execute Bridge via LiFi Diamond                           │
├────────────────────────────────────────────────────────────────────┤
│ Line 54: lifiDiamond.call{value: msg.value}(data_)               │
│   │                                                               │
│   ├─► LiFi Diamond routes to appropriate bridge                  │
│   │    (Could be: Stargate, Across, Hop, etc.)                   │
│   │                                                               │
│   └─► Bridge transfers tokens crosschain                         │
│        Source (Arbitrum) → Destination (Ethereum)                │
└────────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────────┐
│ Step 5: Handle Success or Failure                                 │
├────────────────────────────────────────────────────────────────────┤
│ If success (Line 56-57):                                          │
│   → _recordBridgeSuccess(token, sender, receiver, amount)        │
│      ├─ totalBridgedBySender[token][sender] += amount            │
│      ├─ totalBridged[token] += amount                            │
│      └─ emit BridgeExecuted(...)                                 │
│                                                                   │
│ If failure (Line 59):                                             │
│   → _handleBridgeFailure(token, sender, amount, msg.value, data) │
│      ├─ Refund token to sender                                   │
│      ├─ Refund native (msg.value) to sender                      │
│      └─ emit BridgeFailed(errorMsg)                              │
└────────────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────────────┐
│ Step 6: Funds Arrive on Destination Chain                         │
├────────────────────────────────────────────────────────────────────┤
│ Receiver (User's Smart Account on Ethereum):                     │
│   ├─ Receives 1000 USDC                                          │
│   └─ Automatically deposits into Prime Vaults (if configured)    │
│                                                                   │
│ User now earns yield in Prime Vaults ✓                           │
└────────────────────────────────────────────────────────────────────┘
```

**Code References:**
- [LiFiBridgeExecutor.sol:35-61](contracts/LiFiBridgeExecutor.sol#L35-L61) - Main execute function
- [LiFiBridgeExecutor.sol:70-85](contracts/LiFiBridgeExecutor.sol#L70-L85) - Parameter extraction logic
- [BaseBridgeExecutor.sol:51-55](contracts/BaseBridgeExecutor.sol#L51-L55) - Success recording
- [BaseBridgeExecutor.sol:60-87](contracts/BaseBridgeExecutor.sol#L60-L87) - Failure handling with refunds

---

### Stargate Flow (Core Chain)

**Two Execution Modes:**

#### Mode 1: Regular Execution (User Pays Gas)

```
User on Core Chain
  │
  ├─ 1. Approve USDC to StargateBridgeExecutor
  │
  └─ 2. Call execute(stargateContract, data_, USDC) with msg.value
      │
      ├─► Whitelist Check (Line 64)
      │   require(whitelist[stargateContract], "Not whitelisted")
      │
      ├─► Transfer Token (Line 82-83)
      │   safeTransferFrom(USDC, user, contract, amount)
      │   forceApprove(USDC, stargateContract, amount)
      │
      ├─► Execute Stargate Call (Line 86)
      │   stargateContract.call{value: msg.value}(data_)
      │   └─ User pays gas fee via msg.value
      │
      └─► Record Success or Refund (Line 92-96)
          ├─ Success: _recordBridgeSuccess()
          └─ Failure: _handleBridgeFailure() - refunds USDC + gas
```

#### Mode 2: Sponsored Execution (Protocol Pays Gas) ⭐

```
User on Core Chain
  │
  ├─ 1. Approve USDC to StargateBridgeExecutor
  │
  └─ 2. Call executeSponsored(stargateContract, data_, USDC)
      │   ⚠️ NO msg.value required (gas sponsored!)
      │
      ├─► Whitelist Check (Line 109)
      │   require(whitelist[stargateContract], "Not whitelisted")
      │
      ├─► Extract Fee from Calldata (Line 115)
      │   (SendParam, MessagingFee fee, ) = _extractSendData(data_)
      │
      ├─► Validate Fee (Line 122)
      │   require(fee.nativeFee <= maxFeeAllowed, "Fee too high")
      │   └─ Prevents excessive gas costs
      │
      ├─► Transfer Token (Line 125-126)
      │   safeTransferFrom(USDC, user, contract, amount)
      │   forceApprove(USDC, stargateContract, amount)
      │
      ├─► Execute with Sponsored Gas (Line 129) ⭐
      │   stargateContract.call{value: fee.nativeFee}(data_)
      │   └─ Contract balance pays gas (not user!)
      │
      └─► Record Success (Line 133-135)
          ├─ totalSponsored += amount
          └─ _recordBridgeSuccess()

Gas Sponsorship Economics:
┌──────────────────────────────────────────────────┐
│ Contract Balance (deposited by admin):          │
│   └─ 10 CORE tokens reserved for gas fees      │
│                                                  │
│ User Transaction:                                │
│   ├─ USDC bridged: 1000 USDC                   │
│   ├─ Gas fee: 0.05 CORE (paid by contract)     │
│   └─ User pays: 0 CORE ✓                       │
│                                                  │
│ Remaining Balance: 9.95 CORE                    │
└──────────────────────────────────────────────────┘
```

**Code References:**
- [StargateBridgeExecutor.sol:60-97](contracts/StargateBridgeExecutor.sol#L60-L97) - Regular execute
- [StargateBridgeExecutor.sol:105-139](contracts/StargateBridgeExecutor.sol#L105-L139) - Sponsored execute
- [StargateBridgeExecutor.sol:203-206](contracts/StargateBridgeExecutor.sol#L203-L206) - Admin deposits funds
- [StargateBridgeExecutor.sol:192-196](contracts/StargateBridgeExecutor.sol#L192-L196) - Set maxFeeAllowed cap

---

### Smart Account Integration

**ERC-4337 Smart Account Benefits:**

```
Traditional EOA Wallet:              ERC-4337 Smart Account:
┌──────────────────┐                ┌─────────────────────────┐
│ User Address     │                │ Contract Wallet         │
│ (EOA)            │                │ (Programmable)          │
│                  │                │                         │
│ ❌ Requires gas  │                │ ✅ Gasless transactions │
│ ❌ Manual steps  │    VS          │ ✅ Automated actions    │
│ ❌ Single sig    │                │ ✅ Multi-sig support    │
│ ❌ No recovery   │                │ ✅ Social recovery      │
└──────────────────┘                └─────────────────────────┘

Prime Bridge Executor → Smart Account Flow:
1. User bridges from Arbitrum
2. Funds arrive in Smart Account on PrimeVaults chain
3. Smart Account automatically:
   ├─ Approves Prime Vaults
   ├─ Deposits assets
   └─ Receives vault shares
4. User starts earning yield (no manual steps!)
```

**Why Smart Accounts Matter:**
- **Gasless UX:** Users never pay gas on destination chain
- **Automation:** Immediate deposit into Prime Vaults
- **Security:** Multi-sig + social recovery + spending limits
- **Composability:** Smart account can interact with DeFi protocols

**Technical Details:**
- Standard: [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- Deployment: Counterfactual (deployed on first transaction)
- Ownership: User controls via Entrypoint contract
- Bundler: PrimeProtocol runs bundlers for transaction submission

---

## Contract Documentation

### BaseBridgeExecutor (Abstract Base)

**Purpose:** Provides common bridge execution logic with automatic refunds and statistics tracking.

**Location:** [contracts/BaseBridgeExecutor.sol](contracts/BaseBridgeExecutor.sol)

**Key State Variables:**

```solidity
// Track total bridged per token per sender
mapping(address token => mapping(address sender => uint256 amount)) public totalBridgedBySender;

// Track total bridged globally per token
mapping(address token => uint256 amount) public totalBridged;
```

**Core Functions:**

| Function | Visibility | Purpose | Line Reference |
|----------|-----------|---------|----------------|
| `_recordBridgeSuccess` | `internal` | Update statistics and emit success event | [51-55](contracts/BaseBridgeExecutor.sol#L51-L55) |
| `_handleBridgeFailure` | `internal` | Refund tokens + native on failure | [60-87](contracts/BaseBridgeExecutor.sol#L60-L87) |
| `_decodeError` | `internal pure` | Extract error message from revert data | [39-46](contracts/BaseBridgeExecutor.sol#L39-L46) |
| `emergencyWithdraw` | `external onlyOwner` | Admin emergency withdrawal | [98-109](contracts/BaseBridgeExecutor.sol#L98-L109) |

**Events:**

```solidity
event BridgeExecuted(
    address indexed sender,
    address indexed receiver,
    address token,
    uint256 amount,
    uint256 timestamp
);

event BridgeFailed(string reason);
```

**Security Features:**
- `Ownable` - Access control for admin functions
- `ReentrancyGuard` - Prevents reentrancy attacks (applied by child contracts)
- Automatic refunds - Both token and native refunded on failure

---

### LiFiBridgeExecutor

**Purpose:** Execute crosschain bridges via LI.FI aggregator for EVM chains.

**Location:** [contracts/LiFiBridgeExecutor.sol](contracts/LiFiBridgeExecutor.sol)

**Key State Variables:**

```solidity
address public lifiDiamond;  // LI.FI Diamond aggregator contract address
```

**Configuration:**

| Parameter | Type | Description | Set By |
|-----------|------|-------------|--------|
| `lifiDiamond` | `address` | LI.FI Diamond contract address | Constructor + `setLiFiDiamond()` |

**Core Function: execute()**

```solidity
function execute(bytes calldata data_) external payable nonReentrant
```

**Parameters:**
- `data_` - Transaction calldata from LI.FI API (includes function selector + ABI-encoded params)

**Execution Flow:**

1. **Validate Input** (Line 36)
   ```solidity
   require(data_.length > 0, "Invalid transaction request");
   ```

2. **Extract Parameters** (Line 39)
   ```solidity
   (address sendingAssetId, address receiver, uint256 amount) =
       this.extractMainParameters(data_);
   ```

3. **Handle Token Transfer** (Lines 44-51)
   - If native (address(0)): Check msg.value >= amount
   - If ERC20: SafeTransferFrom user → contract, then approve LiFi Diamond

4. **Execute Bridge** (Line 54)
   ```solidity
   (bool success, bytes memory returnData) = lifiDiamond.call{value: msg.value}(data_);
   ```

5. **Record Result** (Lines 56-60)
   - Success: `_recordBridgeSuccess()`
   - Failure: `_handleBridgeFailure()` (automatic refunds)

**Helper Function: extractMainParameters()**

Decodes LI.FI calldata to extract:
- `sendingAssetId` - Token being bridged
- `receiver` - Destination address (Smart Account)
- `amount` - Amount to bridge

**Logic:**
```solidity
ILiFi.BridgeData memory bridgeData = _extractBridgeData(data_);

if (bridgeData.hasSourceSwaps) {
    // User swapping before bridge (e.g., ETH → USDC → bridge)
    LibSwap.SwapData[] memory swapData = _extractSwapData(data_);
    sendingAssetId = swapData[0].sendingAssetId;
    amount = swapData[0].fromAmount;
} else {
    // Direct bridge (no swap)
    sendingAssetId = bridgeData.sendingAssetId;
    amount = bridgeData.minAmount;
}
```

**Admin Functions:**

| Function | Purpose | Access |
|----------|---------|--------|
| `setLiFiDiamond(address)` | Update LiFi Diamond address | `onlyOwner` |

**Code References:**
- Main execute: [contracts/LiFiBridgeExecutor.sol:35-61](contracts/LiFiBridgeExecutor.sol#L35-L61)
- Parameter extraction: [contracts/LiFiBridgeExecutor.sol:70-85](contracts/LiFiBridgeExecutor.sol#L70-L85)
- Data extractors: [contracts/lifi/LiFiTxDataExtractor.sol](contracts/lifi/LiFiTxDataExtractor.sol)

---

### StargateBridgeExecutor

**Purpose:** Execute Stargate bridges with whitelist security and gas sponsorship.

**Location:** [contracts/StargateBridgeExecutor.sol](contracts/StargateBridgeExecutor.sol)

**Key State Variables:**

```solidity
mapping(address => bool) public whitelist;     // Approved Stargate contracts
uint256 public maxFeeAllowed;                  // Max gas fee for sponsorship
uint256 public totalSponsored;                 // Total sponsored amount
```

**Configuration:**

| Parameter | Type | Description | Set By |
|-----------|------|-------------|--------|
| `whitelist` | `mapping` | Approved Stargate contract addresses | `addToWhitelist()` |
| `maxFeeAllowed` | `uint256` | Maximum gas fee cap (in Wei) | `setMaxFeeAllowed()` |
| Contract Balance | `native` | Reserved for gas sponsorship | `depositFunds()` |

**Core Function 1: execute() - User Pays Gas**

```solidity
function execute(
    address to_,        // Stargate contract address (must be whitelisted)
    bytes calldata data_, // Stargate function call data
    address token_      // Token to bridge (or address(0) for native)
) external payable nonReentrant onlyWhitelisted(to_)
```

**Execution Flow:**

1. **Whitelist Check** (Line 64)
   ```solidity
   modifier onlyWhitelisted(address _to) {
       require(whitelist[_to], "Address not in whitelist");
   }
   ```

2. **Extract Parameters** (Line 69)
   ```solidity
   (SendParam memory sendParam, , ) = _extractSendData(data_);
   uint256 amount = sendParam.amountLD;
   address receiver = address(uint160(uint256(sendParam.to)));
   ```

3. **Handle Token** (Lines 78-84)
   - Native: Require msg.value >= amount
   - ERC20: TransferFrom + Approve

4. **Execute Bridge** (Line 86)
   ```solidity
   (bool success, bytes memory returnData) = to_.call{value: msg.value}(data_);
   ```
   User pays gas via msg.value

5. **Cleanup & Record** (Lines 88-96)
   - Reset approval to 0 (security best practice)
   - Record success or handle failure

**Core Function 2: executeSponsored() - Protocol Pays Gas ⭐**

```solidity
function executeSponsored(
    address to_,
    bytes calldata data_,
    address token_       // Must be ERC20 (not address(0))
) external nonReentrant onlyWhitelisted(to_)
```

**Key Differences from execute():**
- **No msg.value** - User doesn't pay gas
- **Fee validation** - Extracts fee from calldata, checks against maxFeeAllowed
- **Contract pays** - Uses contract balance for gas (Line 129)
- **Tracking** - Increments totalSponsored counter

**Execution Flow:**

1. **Validate Input** (Line 111)
   ```solidity
   require(token_ != address(0), "Not supported token");
   // Sponsorship only for ERC20 tokens, not native
   ```

2. **Extract & Validate Fee** (Lines 115, 122)
   ```solidity
   (SendParam memory sendParam, MessagingFee memory fee, ) = _extractSendData(data_);
   require(fee.nativeFee > 0 && fee.nativeFee <= maxFeeAllowed, "Invalid fee");
   ```

3. **Execute with Sponsored Gas** (Line 129)
   ```solidity
   to_.call{value: fee.nativeFee}(data_);
   // fee.nativeFee paid from contract balance, NOT user!
   ```

4. **Update Sponsorship Stats** (Line 134)
   ```solidity
   totalSponsored += amount;
   ```

**Whitelist Management:**

| Function | Purpose | Gas Efficient |
|----------|---------|---------------|
| `addToWhitelist(address)` | Add single address | For 1-2 addresses |
| `addMultipleToWhitelist(address[])` | Add up to 100 addresses | Batch operations |
| `removeFromWhitelist(address)` | Remove single address | Revoke access |

**Gas Sponsorship Management:**

| Function | Purpose | Access |
|----------|---------|--------|
| `depositFunds()` | Deposit native to sponsor gas | `onlyOwner` + payable |
| `withdrawFunds(uint256)` | Withdraw specific amount | `onlyOwner` |
| `withdrawAllFunds()` | Withdraw all native | `onlyOwner` |
| `setMaxFeeAllowed(uint256)` | Set gas fee cap | `onlyOwner` |

**Events:**

```solidity
event WhitelistAdded(address indexed user);
event WhitelistRemoved(address indexed user);
event FundsDeposited(address indexed depositor, uint256 amount);
event FundsWithdrawn(address indexed recipient, uint256 amount);
event MaxFeeUpdated(uint256 maxFee);
```

**Code References:**
- Regular execute: [contracts/StargateBridgeExecutor.sol:60-97](contracts/StargateBridgeExecutor.sol#L60-L97)
- Sponsored execute: [contracts/StargateBridgeExecutor.sol:105-139](contracts/StargateBridgeExecutor.sol#L105-L139)
- Whitelist management: [contracts/StargateBridgeExecutor.sol:149-184](contracts/StargateBridgeExecutor.sol#L149-L184)
- Funds management: [contracts/StargateBridgeExecutor.sol:192-237](contracts/StargateBridgeExecutor.sol#L192-L237)

---

### Data Extractors

#### LiFiTxDataExtractor

**Purpose:** Decode LI.FI API calldata to extract bridge parameters.

**Location:** [contracts/lifi/LiFiTxDataExtractor.sol](contracts/lifi/LiFiTxDataExtractor.sol)

**Functions:**

1. **_extractBridgeData()**
   ```solidity
   function _extractBridgeData(bytes calldata data)
       internal pure
       returns (ILiFi.BridgeData memory bridgeData)
   ```

   Extracts:
   - `transactionId` - Unique transaction ID
   - `bridge` - Bridge protocol name (e.g., "stargate")
   - `sendingAssetId` - Token address
   - `receiver` - Destination address
   - `minAmount` - Minimum amount to receive
   - `destinationChainId` - Target chain ID
   - `hasSourceSwaps` - Whether swap occurs before bridge

2. **_extractSwapData()**
   ```solidity
   function _extractSwapData(bytes calldata data)
       internal pure
       returns (LibSwap.SwapData[] memory swapData)
   ```

   Extracts array of swap operations:
   - `sendingAssetId` - Input token
   - `receivingAssetId` - Output token
   - `fromAmount` - Input amount
   - `callTo` - DEX/swap contract
   - `callData` - Swap function calldata

**Data Structures:**

```solidity
// From ILiFi.sol
struct BridgeData {
    bytes32 transactionId;
    string bridge;
    string integrator;
    address referrer;
    address sendingAssetId;
    address receiver;
    uint256 minAmount;
    uint256 destinationChainId;
    bool hasSourceSwaps;
    bool hasDestinationCall;
}

// From LibSwap.sol
struct SwapData {
    address callTo;
    address approveTo;
    address sendingAssetId;
    address receivingAssetId;
    uint256 fromAmount;
    bytes callData;
    bool requiresDeposit;
}
```

#### StargateTxDataExtractor

**Purpose:** Decode Stargate calldata to extract send parameters and fees.

**Location:** [contracts/stargate/StargateTxDataExtractor.sol](contracts/stargate/StargateTxDataExtractor.sol)

**Function:**

```solidity
function _extractSendData(bytes calldata data)
    internal pure
    returns (
        SendParam memory sendParam,
        MessagingFee memory fee,
        address refundAddress
    )
```

**Extracted Data:**

```solidity
// From LayerZero OFT interface
struct SendParam {
    uint32 dstEid;           // Destination endpoint ID
    bytes32 to;              // Receiver address (bytes32 encoded)
    uint256 amountLD;        // Amount in local decimals
    uint256 minAmountLD;     // Minimum amount to receive
    bytes extraOptions;      // Additional options
    bytes composeMsg;        // Compose message
    bytes oftCmd;            // OFT command
}

struct MessagingFee {
    uint256 nativeFee;       // Gas fee in native token
    uint256 lzTokenFee;      // LayerZero token fee
}
```

**Usage in StargateBridgeExecutor:**
- `sendParam.amountLD` → Amount to bridge
- `sendParam.to` → Receiver address (converted to address via uint160)
- `fee.nativeFee` → Gas fee (validated against maxFeeAllowed)

---

## Integration Guide

### For Frontend Developers

#### When to Use LiFi vs Stargate

| Criteria | Use LiFiBridgeExecutor | Use StargateBridgeExecutor |
|----------|----------------------|---------------------------|
| **Source Chain** | Arbitrum, BSC, Polygon, Optimism, etc. | Core chain |
| **Gas Payment** | User always pays gas | User pays OR protocol sponsors |
| **API Integration** | LI.FI REST API | Stargate SDK |
| **Protocol Selection** | Automatic (LI.FI chooses) | Stargate only |
| **Complexity** | Simple (1 call) | Medium (whitelist + optional sponsorship) |

#### LiFi Integration Example (Conceptual)

```typescript
// 1. Get quote from LI.FI API
const quote = await fetch('https://li.quest/v1/quote', {
  params: {
    fromChain: 'ARB',           // Arbitrum
    toChain: 'ETH',             // Ethereum (PrimeVaults)
    fromToken: 'USDC',
    toToken: 'USDC',
    fromAmount: '1000000000',   // 1000 USDC (6 decimals)
    fromAddress: userAddress,
    toAddress: smartAccountAddress  // User's Smart Account on destination
  }
});

// 2. Get transaction data
const txData = quote.transactionRequest.data;

// 3. Execute bridge
const tx = await liFiBridgeExecutor.execute(txData, {
  value: quote.transactionRequest.value  // Gas fee
});

// 4. Wait for confirmation
await tx.wait();

// 5. Track crosschain (via LI.FI API)
const status = await fetch(`https://li.quest/v1/status?txHash=${tx.hash}`);
```

#### Stargate Integration Example (Conceptual)

```typescript
// 1. Build Stargate send parameters
const sendParam = {
  dstEid: 30101,                    // Ethereum LayerZero endpoint
  to: ethers.zeroPadValue(smartAccountAddress, 32),
  amountLD: ethers.parseUnits('1000', 6),  // 1000 USDC
  minAmountLD: ethers.parseUnits('995', 6), // 0.5% slippage
  extraOptions: '0x',
  composeMsg: '0x',
  oftCmd: '0x'
};

// 2. Quote gas fee
const fee = await stargatePool.quoteSend(sendParam, false);

// 3. Encode calldata
const data = stargatePool.interface.encodeFunctionData('send', [
  sendParam,
  fee,
  userAddress  // refund address
]);

// 4. Execute (regular or sponsored)
if (isSponsored) {
  // Protocol pays gas
  const tx = await stargateBridgeExecutor.executeSponsored(
    stargatePoolAddress,
    data,
    usdcAddress
  );
} else {
  // User pays gas
  const tx = await stargateBridgeExecutor.execute(
    stargatePoolAddress,
    data,
    usdcAddress,
    { value: fee.nativeFee }
  );
}
```

---

### For Smart Contract Developers

#### Deployment Checklist

**LiFiBridgeExecutor:**

```solidity
// 1. Deploy
LiFiBridgeExecutor executor = new LiFiBridgeExecutor(lifiDiamondAddress);

// 2. Transfer ownership (if needed)
executor.transferOwnership(multisigAddress);

// 3. Verify on block explorer
```

**StargateBridgeExecutor:**

```solidity
// 1. Deploy
StargateBridgeExecutor executor = new StargateBridgeExecutor();

// 2. Add Stargate contracts to whitelist
address[] memory stargateContracts = [
  0x...,  // Stargate USDC pool
  0x...,  // Stargate ETH pool
  0x...   // Stargate USDT pool
];
executor.addMultipleToWhitelist(stargateContracts);

// 3. Set maximum gas fee (e.g., 0.1 CORE)
executor.setMaxFeeAllowed(0.1 ether);

// 4. Fund gas sponsorship (e.g., 100 CORE)
executor.depositFunds{value: 100 ether}();

// 5. Transfer ownership
executor.transferOwnership(multisigAddress);
```

#### Configuration Parameters

| Contract | Parameter | Recommended Value | Rationale |
|----------|-----------|-------------------|-----------|
| LiFiBridgeExecutor | `lifiDiamond` | Latest LI.FI Diamond per chain | Maintained by LI.FI team |
| StargateBridgeExecutor | `maxFeeAllowed` | 0.05-0.1 native token | Prevent excessive gas costs |
| StargateBridgeExecutor | Initial funding | 50-100 native tokens | Support ~500-1000 sponsored txs |
| StargateBridgeExecutor | Whitelist | Official Stargate pools only | Security: prevent malicious contracts |

#### Adding New Bridge Protocols

To integrate a new bridge protocol (e.g., Across, Hop):

1. **Create Executor Contract:**
   ```solidity
   contract AcrossBridgeExecutor is BaseBridgeExecutor, AcrossTxDataExtractor {
       address public acrossRouter;

       function execute(bytes calldata data_) external payable nonReentrant {
           // Extract parameters
           // Transfer tokens
           // Call Across router
           // Record success/failure
       }
   }
   ```

2. **Create Data Extractor:**
   ```solidity
   contract AcrossTxDataExtractor {
       function _extractAcrossParams(bytes calldata data)
           internal pure
           returns (address token, address receiver, uint256 amount)
       {
           // Decode Across-specific calldata
       }
   }
   ```

3. **Test Thoroughly:**
   - Success scenarios
   - Failure scenarios with refunds
   - Edge cases (zero amounts, invalid addresses)

---

### For Protocol Admins

#### Managing Whitelist (Stargate)

**Add Single Contract:**
```solidity
// Add new Stargate pool
stargateBridgeExecutor.addToWhitelist(0x1234...);
```

**Add Multiple Contracts (Gas Efficient):**
```solidity
address[] memory pools = new address[](3);
pools[0] = 0x1234...;  // USDC pool
pools[1] = 0x5678...;  // ETH pool
pools[2] = 0x9abc...;  // USDT pool

stargateBridgeExecutor.addMultipleToWhitelist(pools);
```

**Remove Compromised Contract:**
```solidity
stargateBridgeExecutor.removeFromWhitelist(0x1234...);
```

#### Funding Gas Sponsorship

**Initial Setup:**
```solidity
// Deposit 100 CORE for sponsorship
stargateBridgeExecutor.depositFunds{value: 100 ether}();
```

**Monitoring Balance:**
```solidity
uint256 balance = address(stargateBridgeExecutor).balance;
console.log("Remaining sponsor balance:", balance);

// Alert if balance < 10 CORE
if (balance < 10 ether) {
    // Top up
    stargateBridgeExecutor.depositFunds{value: 50 ether}();
}
```

**Withdrawing Excess:**
```solidity
// Withdraw 20 CORE
stargateBridgeExecutor.withdrawFunds(20 ether);

// Or withdraw all
stargateBridgeExecutor.withdrawAllFunds();
```

#### Monitoring Bridge Statistics

**Query On-Chain:**
```solidity
// Total bridged globally (e.g., for USDC)
uint256 total = executor.totalBridged(usdcAddress);

// Total bridged by specific user
uint256 userTotal = executor.totalBridgedBySender(usdcAddress, userAddress);

// Stargate-specific: Total sponsored amount
uint256 sponsored = stargateBridgeExecutor.totalSponsored();
```

**Event Monitoring:**
```typescript
// Listen for successful bridges
executor.on("BridgeExecuted", (sender, receiver, token, amount, timestamp) => {
  console.log(`Bridge: ${sender} → ${receiver}, ${amount} ${token}`);
  // Update analytics dashboard
});

// Listen for failures
executor.on("BridgeFailed", (reason) => {
  console.error(`Bridge failed: ${reason}`);
  // Alert monitoring system
});
```

---

## Security Considerations

### Security Features

| Feature | Implementation | Protection Against |
|---------|---------------|-------------------|
| **Reentrancy Guard** | `nonReentrant` modifier | Reentrancy attacks |
| **Whitelist** | `onlyWhitelisted` modifier (Stargate) | Malicious contracts |
| **Automatic Refunds** | `_handleBridgeFailure()` | User fund loss on errors |
| **Gas Fee Caps** | `maxFeeAllowed` check | Excessive sponsorship costs |
| **Access Control** | `Ownable` + `onlyOwner` | Unauthorized admin actions |
| **Safe Token Transfers** | `SafeERC20` library | Token transfer exploits |
| **Approval Reset** | `forceApprove(token, target, 0)` | Approval-based attacks |

### Invariants

**Critical Invariants (must always hold):**

```solidity
// 1. Contract never holds user tokens after successful execution
executor.balanceOf(token) == 0 (after successful bridge)

// 2. On failure, user receives full refund
userBalanceBefore == userBalanceAfter (on bridge failure)

// 3. Stargate whitelist integrity
whitelist[maliciousContract] == false (always)

// 4. Gas sponsorship bounded
fee.nativeFee <= maxFeeAllowed (in executeSponsored)

// 5. Statistics accuracy
totalBridged[token] == sum(totalBridgedBySender[token][*])
```

### Attack Vectors & Mitigations

#### 1. Reentrancy Attack

**Attack:** Malicious contract calls execute() and reenters during token transfer.

**Mitigation:**
```solidity
function execute(...) external payable nonReentrant {
    // ReentrancyGuard prevents reentrant calls
}
```

#### 2. Approval Exploitation

**Attack:** Malicious contract drains approved tokens.

**Mitigation:**
```solidity
// Stargate: Reset approval to 0 after call
SafeERC20.forceApprove(IERC20(token_), to_, amount);
(bool success, ) = to_.call{value: msg.value}(data_);
SafeERC20.forceApprove(IERC20(token_), to_, 0);  // ← Reset
```

#### 3. Gas Sponsorship Drain

**Attack:** User submits many high-fee transactions to drain sponsor balance.

**Mitigation:**
```solidity
// Cap maximum gas fee
require(fee.nativeFee <= maxFeeAllowed, "Fee too high");
```

#### 4. Whitelist Bypass (Stargate)

**Attack:** User calls non-whitelisted malicious contract.

**Mitigation:**
```solidity
modifier onlyWhitelisted(address _to) {
    require(whitelist[_to], "Address not in whitelist");
    _;
}
```

#### 5. Failed Bridge with No Refund

**Attack:** Bridge fails, user loses funds.

**Mitigation:**
```solidity
function _handleBridgeFailure(...) internal {
    // Automatic refund of both token and native
    if (token != address(0)) {
        SafeERC20.safeTransfer(IERC20(token), sender, amount);
    }
    if (nativeAmount > 0) {
        (bool success, ) = sender.call{value: nativeAmount}("");
        require(success, "Refund failed");
    }
}
```

### Best Practices

**For Admins:**
1. **Whitelist Management:**
   - Only add verified Stargate contracts
   - Remove contracts immediately upon compromise
   - Regularly audit whitelist against official Stargate deployments

2. **Gas Sponsorship:**
   - Set conservative `maxFeeAllowed` (0.05-0.1 native token)
   - Monitor contract balance daily
   - Alert when balance < 20% of initial deposit
   - Never set `maxFeeAllowed` to unlimited

3. **Emergency Procedures:**
   - Keep emergency withdrawal private key secure
   - Test emergency withdrawal on testnet first
   - Document emergency procedures for team

**For Users:**
1. **Transaction Verification:**
   - Verify receiver address (Smart Account) before confirming
   - Check token approval amount matches bridge amount
   - Monitor transaction status via LI.FI or Stargate explorers

2. **Failed Transactions:**
   - Refunds are automatic - check wallet balance
   - Contact support if refund not received within 1 hour
   - Do NOT re-submit failed transaction immediately (wait for refund)

**For Developers:**
1. **Integration Testing:**
   - Test both success and failure scenarios
   - Verify refunds work correctly
   - Test edge cases (zero amounts, invalid addresses)
   - Load test gas sponsorship limits

2. **Monitoring:**
   - Set up event listeners for `BridgeExecuted` and `BridgeFailed`
   - Alert on unusual patterns (many failures, high volumes)
   - Track gas sponsorship burn rate

---

## Development Setup

### Prerequisites

- **Runtime:** [Bun](https://bun.sh/) v1.0+ or Node.js v18+
- **Framework:** [Hardhat](https://hardhat.org/) v2.19+
- **Solidity:** ^0.8.30

### Installation

```bash
# Clone repository
git clone https://github.com/Beraji-Labs/bridge-executor.git
cd bridge-executor

# Install dependencies
bun install

# Compile contracts
bun run compile
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run compile` | Compile Solidity contracts |
| `bun run test` | Run test suite |
| `bun run coverage` | Generate coverage report |
| `bun run lint` | Lint Solidity + TypeScript |
| `bun run lint:sol` | Lint Solidity only |
| `bun run lint:ts` | Lint TypeScript only |
| `bun run prettier:write` | Format all files |
| `bun run clean` | Clean artifacts and cache |

### Project Structure

```
prime-bridge-executor/
├── contracts/
│   ├── BaseBridgeExecutor.sol           # Base contract
│   ├── LiFiBridgeExecutor.sol           # LI.FI integration
│   ├── StargateBridgeExecutor.sol       # Stargate integration
│   ├── lifi/
│   │   ├── ILiFi.sol                    # LI.FI interfaces
│   │   ├── LibSwap.sol                  # Swap data structures
│   │   └── LiFiTxDataExtractor.sol      # Calldata decoder
│   └── stargate/
│       └── StargateTxDataExtractor.sol  # Calldata decoder
├── docs/
│   └── ARCHITECTURE.md                  # Prime Vaults architecture
├── test/
│   └── main.ts                          # Test suite
├── tasks/
│   └── executor.ts                      # Deployment tasks
├── hardhat.config.ts                    # Hardhat configuration
└── package.json                         # Dependencies
```

### Network Configuration

See [hardhat.config.ts](hardhat.config.ts) for network configurations including:
- Mainnet (Ethereum, Arbitrum, BSC, Polygon, etc.)
- Testnets (Sepolia, Goerli, etc.)
- RPC endpoints and verification settings

### Deployment

**Deploy LiFiBridgeExecutor:**
```bash
bunx hardhat run scripts/deploy-lifi.ts --network arbitrum
```

**Deploy StargateBridgeExecutor:**
```bash
bunx hardhat run scripts/deploy-stargate.ts --network core
```

Refer to deployment scripts in `scripts/` for detailed setup.

---

## Further Reading

### Prime Vaults Ecosystem

- [Architecture Documentation](docs/ARCHITECTURE.md) - Complete Prime Vaults system architecture
- Prime Vaults Contracts - Main vault implementation (separate repository)

### Bridge Protocols

- [LI.FI Documentation](https://docs.li.fi/) - LI.FI API and integration guide
- [LI.FI Contracts](https://github.com/lifinance/contracts) - LI.FI Diamond source code
- [Stargate Documentation](https://stargatefi.gitbook.io/) - Stargate protocol overview
- [Stargate V2 Contracts](https://github.com/stargate-protocol/stargate-v2) - Stargate implementation

### Account Abstraction

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337) - Account abstraction standard
- [Account Abstraction Guide](https://www.erc4337.io/) - Introduction to smart accounts
- [Bundler Documentation](https://docs.stackup.sh/) - ERC-4337 bundler implementation

### Security Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/) - Security best practices
- [Smart Contract Security](https://github.com/crytic/building-secure-contracts) - Audit guidelines
- [Rekt News](https://rekt.news/) - DeFi exploit analysis

---

## License

This project is licensed under the **MIT License** - see the [LICENSE.md](LICENSE.md) file for details.

---

## Built By

**Beraji-Labs**
[GitHub](https://github.com/Beraji-Labs) | [Website](https://beraji.io)

© 2024 Beraji-Labs. Built with Hardhat, Solidity, and TypeScript.

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Contact & Support

- **Issues:** [GitHub Issues](https://github.com/Beraji-Labs/bridge-executor/issues)
- **Security:** security@beraji.io (for vulnerability reports)
- **General:** contact@beraji.io

---

**Note:** This documentation is optimized for AI training and technical understanding. For user-facing documentation, refer to the Prime Vaults frontend documentation.
