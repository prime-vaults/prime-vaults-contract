# PrimeVaults Smart Contracts

**PrimeVaults** is an enterprise-grade DeFi vault infrastructure built on the BoringVault architecture. It provides a
secure, flexible, and composable framework for managing yield strategies with single-asset architecture.

## 📖 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Contracts](#core-contracts)
- [Flow of Funds](#flow-of-funds)
- [Role-Based Access Control](#role-based-access-control)
- [Contract Structure](#contract-structure)
- [Development](#development)
- [Security](#security)

---

## 🔍 Overview

PrimeVaults implements a **single-asset vault model** where each vault supports exactly one ERC20 token. This design
simplifies security, reduces complexity, and eliminates MEV opportunities associated with multi-asset vaults.

### Key Features

✅ **Single-Asset Architecture**: One vault = one token, eliminating complex asset swapping logic  
✅ **Modular Design**: Minimal core vault contract (~100 lines) with logic delegated to external modules  
✅ **Yield Streaming**: Time-weighted yield distribution with TWAS (Time-Weighted Average Supply) validation  
✅ **Buffer Helpers**: Automatic capital deployment to yield strategies  
✅ **Role-Based Security**: Granular permission system via RolesAuthority  
✅ **Transfer Hooks**: Customizable share transfer restrictions for compliance  
✅ **Non-Custodial**: User funds secured in audited smart contracts

---

## 🏗 Architecture

PrimeVaults follows the BoringVault architecture pattern with these core components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│              (Deposits/Withdraws via Teller)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TELLER CONTRACT                               │
│  • Handles user deposits & withdrawals                           │
│  • Enforces share lock periods                                   │
│  • Manages deposit caps                                          │
│  • Triggers buffer helper hooks                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BORINGVAULT (CORE)                             │
│  • Minimal vault contract (~100 lines)                           │
│  • Holds user assets                                             │
│  • Mints/burns vault shares                                      │
│  • Delegates strategy execution to Manager                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│    ACCOUNTANT        │        │    BUFFER HELPER     │
│  • Exchange rate     │        │  • Auto-deploy       │
│  • Fee calculation   │        │    capital           │
│  • Yield streaming   │        │  • Strategy calls    │
│  • TWAS validation   │        │  • Yield optimization│
└──────────────────────┘        └──────────────────────┘
           │
           ▼
┌──────────────────────┐
│    MANAGER           │
│  (Future: Merkle     │
│   verification)      │
└──────────────────────┘
```

---

## 📦 Core Contracts

### 1. **BoringVault**

_The foundation of the vault system_

- **Purpose**: Minimal vault contract that holds user assets and delegates complex logic
- **Size**: ~16 KB (100 lines of core logic)
- **Key Functions**:
  - `enter()`: Mints vault shares in exchange for assets
  - `exit()`: Burns vault shares and returns assets
  - `manage()`: Executes strategy calls (restricted to authorized managers)
  - `setBeforeTransferHook()`: Configures transfer restrictions

**Authorization**: Requires `MINTER_ROLE` for deposits, `BURNER_ROLE` for withdrawals

---

### 2. **TellerWithMultiAssetSupport**

_User-facing deposit/withdrawal interface_

- **Purpose**: Facilitates user interactions with the vault
- **Size**: ~18 KB
- **Key Features**:
  - Single asset support (despite the name - legacy from multi-asset refactor)
  - Share lock periods to prevent flashloan attacks
  - Deposit caps for risk management
  - Native ETH wrapping support
  - Permit-based deposits (gasless approvals)

**State Management**:

```solidity
struct TellerState {
  bool isPaused; // Emergency pause
  bool allowDeposits; // Toggle deposits
  bool allowWithdraws; // Toggle withdrawals
  bool permissionedTransfers; // Require whitelisting
  uint64 shareLockPeriod; // Minimum holding period
  uint112 depositCap; // Maximum total shares
}
```

**Key Functions**:

- `deposit()`: Public deposits with optional native ETH
- `depositWithPermit()`: Gasless approval deposits
- `withdraw()`: Burns shares for underlying assets
- `bulkDeposit()`: Authorized batch deposits
- `bulkWithdraw()`: Authorized batch withdrawals

---

### 3. **TellerWithBuffer**

_Automatic capital deployment layer_

- **Purpose**: Integrates buffer helpers to automate yield strategy allocation
- **Size**: ~20 KB
- **How It Works**:
  1. User deposits → Teller receives assets
  2. `_afterDeposit()` hook triggers → Buffer helper generates strategy calls
  3. Vault executes `manage()` calls → Assets deployed to yield protocols
  4. On withdrawal: `_beforeWithdraw()` → Buffer helper unwinds positions

**Buffer Helper Interface**:

```solidity
struct BufferHelpers {
  IBufferHelper depositBufferHelper; // Deploy capital after deposits
  IBufferHelper withdrawBufferHelper; // Unwind positions before withdrawals
}
```

**Example**: `PrimeStrategyV1BufferHelper` automatically deposits assets into a strategy manager contract.

---

### 4. **TellerWithYieldStreaming**

_Optimized for yield distribution vaults_

- **Purpose**: Updates exchange rates before every deposit/withdrawal
- **Size**: ~21 KB
- **Key Behavior**:
  - Calls `accountant.updateExchangeRate()` before user actions
  - Ensures users get latest yield-adjusted share prices
  - Triggers before transfer hooks for compliance

---

### 5. **AccountantWithRateProviders**

_Exchange rate and fee management_

- **Purpose**: Provides share pricing and fee accounting
- **Size**: ~12 KB
- **Core Responsibilities**:
  - Maintains exchange rate (vault shares → underlying assets)
  - Rate limiting: Minimum delay between updates
  - Bound limiting: Max deviation per update
  - Pauses vault if anomalies detected
  - Calculates platform fees and performance fees

**State Structure**:

```solidity
struct AccountantState {
  address payoutAddress; // Where fees are sent
  uint128 feesOwedInBase; // Pending fee amount
  uint128 totalSharesLastUpdate; // Share supply snapshot
  uint96 exchangeRate; // Current rate (18 decimals)
  uint16 allowedExchangeRateChangeUpper; // Max increase (bps)
  uint16 allowedExchangeRateChangeLower; // Max decrease (bps)
  uint64 lastUpdateTimestamp; // Last update time
  bool isPaused; // Pause state
  uint24 minimumUpdateDelayInSeconds; // Rate limit
  uint16 platformFee; // Annual platform fee (bps)
  uint16 performanceFee; // Performance fee (bps)
}
```

**Fee Calculation**:

- **Platform Fee**: `(minAssets * platformFee * timeDelta) / (1e4 * 365 days)`
- **Performance Fee**: `(yieldEarned * performanceFee) / 1e4`

---

### 6. **AccountantWithYieldStreaming**

_Advanced yield distribution with TWAS validation_

- **Purpose**: Streams yield over time instead of instant distribution
- **Size**: ~18 KB
- **Key Concepts**:
  - **Vesting**: Yield is distributed linearly over a period (1-7 days default)
  - **TWAS**: Time-Weighted Average Supply prevents manipulation
  - **Anti-Manipulation**: Requires yield vests to be within deviation bounds

**Vesting Flow**:

1. Strategist calls `vestYield(amount, duration)`
2. Contract validates:
   - Duration within bounds (1-7 days)
   - Yield not too large vs. TWAS
   - Minimum update delay respected
3. Yield streams into exchange rate over vesting period

**State Tracking**:

```solidity
struct VestingState {
  uint128 lastSharePrice; // Previous exchange rate
  uint128 vestingGains; // Remaining yield to vest
  uint128 lastVestingUpdate; // Last vest update time
  uint64 startVestingTime; // Vest period start
  uint64 endVestingTime; // Vest period end
}

struct SupplyObservation {
  uint256 cumulativeSupply; // ∫ totalSupply dt
  uint256 cumulativeSupplyLast; // Previous cumulative
  uint256 lastUpdateTimestamp; // Observation timestamp
}
```

---

### 7. **RolesAuthority**

_Permission management system_

- **Purpose**: Implements role-based access control (RBAC)
- **Size**: ~6 KB
- **Capabilities**:
  - `setRoleCapability()`: Grant role X permission to call function Y on contract Z
  - `setPublicCapability()`: Make function publicly callable
  - `setUserRole()`: Assign role to address

**Role Definitions**:

```solidity
uint8 constant MINTER_ROLE = 1; // Can mint vault shares
uint8 constant ADMIN_ROLE = 1; // Admin permissions
uint8 constant BORING_VAULT_ROLE = 4; // Vault contract itself
uint8 constant UPDATE_EXCHANGE_RATE_ROLE = 3; // Can update prices
uint8 constant STRATEGIST_ROLE = 7; // Can vest yield
uint8 constant BURNER_ROLE = 8; // Can burn shares
uint8 constant SOLVER_ROLE = 9; // Bulk operations
```

---

### 8. **PrimeVaultFactory**

_Deployment configuration helper_

- **Purpose**: Configures role permissions for deployed vault systems
- **Size**: ~6 KB (reference-only, no deployment)
- **Key Function**: `setup()` assigns all roles and capabilities in one transaction

**Setup Process**:

```solidity
function setup(
  RolesAuthority rolesAuthority,
  BoringVault boringVault,
  AccountantWithYieldStreaming accountant,
  TellerWithYieldStreaming teller
) external onlyOwner {
  // 1. Configure function permissions
  rolesAuthority.setRoleCapability(MINTER_ROLE, vault, vault.enter.selector, true);

  // 2. Make user functions public
  rolesAuthority.setPublicCapability(teller, teller.deposit.selector, true);

  // 3. Assign roles to contracts
  rolesAuthority.setUserRole(teller, MINTER_ROLE, true);
}
```

---

## 💰 Flow of Funds

### Deposit Flow

```
1. User → Teller.deposit(1000 USDC)
   ├─ Teller checks: not paused, deposits allowed
   ├─ Teller transfers 1000 USDC from user
   └─ Teller calculates shares = amount * ONE_SHARE / exchangeRate

2. Teller → Vault.enter(user, USDC, 1000, user, shares)
   ├─ Vault mints 950 shares to user
   └─ Emits Enter event

3. Teller → _afterDeposit(1000)
   ├─ BufferHelper generates strategy calls
   ├─ Vault.manage([strategyManager], [deposit(1000)], [0])
   └─ 1000 USDC deployed to yield strategy

4. Share Lock Applied
   └─ Shares locked to user address for shareLockPeriod (prevents MEV)
```

### Withdrawal Flow

```
1. User → Teller.withdraw(950 shares)
   ├─ Teller checks: not paused, withdrawals allowed
   └─ Teller verifies share lock period expired

2. Teller → _beforeWithdraw(1050)
   ├─ BufferHelper calculates assets needed
   ├─ Vault.manage([strategyManager], [withdraw(1050)], [0])
   └─ 1050 USDC withdrawn from strategy

3. Teller → Vault.exit(user, USDC, 1050, user, 950)
   ├─ Vault burns 950 shares from user
   ├─ Vault transfers 1050 USDC to user
   └─ Emits Exit event (user gained 50 USDC yield)
```

### Yield Update Flow

```
1. Strategist → Accountant.vestYield(5000 USDC, 3 days)
   ├─ Validates: duration bounds, TWAS deviation
   ├─ Updates vesting state:
   │  └─ vestingGains = 5000
   │  └─ endVestingTime = now + 3 days
   └─ Emits YieldRecorded event

2. Oracle → Accountant.updateExchangeRate() [every 24h]
   ├─ Calculates vested yield: (5000 * elapsed) / 3 days
   ├─ Updates exchange rate: oldRate + (vestedYield / totalShares)
   ├─ Calculates platform fees
   └─ Updates state

3. Vault → Accountant.claimFees()
   ├─ Transfers accumulated fees to payoutAddress
   └─ Resets feesOwedInBase to 0
```

---

## 🔐 Role-Based Access Control

### Permission Matrix

| Function                  | Role Required             | Contract                     |
| ------------------------- | ------------------------- | ---------------------------- |
| `deposit()`               | PUBLIC                    | TellerWithYieldStreaming     |
| `depositWithPermit()`     | PUBLIC                    | TellerWithYieldStreaming     |
| `withdraw()`              | PUBLIC                    | TellerWithYieldStreaming     |
| `bulkDeposit()`           | SOLVER_ROLE               | TellerWithMultiAssetSupport  |
| `bulkWithdraw()`          | SOLVER_ROLE               | TellerWithMultiAssetSupport  |
| `enter()`                 | MINTER_ROLE               | BoringVault                  |
| `exit()`                  | BURNER_ROLE               | BoringVault                  |
| `manage()`                | MANAGER_ROLE              | BoringVault                  |
| `updateExchangeRate()`    | UPDATE_EXCHANGE_RATE_ROLE | AccountantWithRateProviders  |
| `vestYield()`             | STRATEGIST_ROLE           | AccountantWithYieldStreaming |
| `claimFees()`             | BORING_VAULT_ROLE         | AccountantWithRateProviders  |
| `pause()`                 | ADMIN_ROLE                | Teller/Accountant            |
| `setBeforeTransferHook()` | OWNER                     | BoringVault                  |

### Role Assignment

```solidity
// Teller can mint and burn vault shares
rolesAuthority.setUserRole(teller, MINTER_ROLE, true);
rolesAuthority.setUserRole(teller, BURNER_ROLE, true);

// Accountant can update rates and claim fees
rolesAuthority.setUserRole(accountant, UPDATE_EXCHANGE_RATE_ROLE, true);
rolesAuthority.setUserRole(accountant, STRATEGIST_ROLE, true);

// Vault contract can claim its own fees
rolesAuthority.setUserRole(vault, BORING_VAULT_ROLE, true);
```

---

## 📁 Contract Structure

```
contracts/
├── core/
│   ├── BoringVault.sol                    # Minimal vault core (~16 KB)
│   ├── TellerWithMultiAssetSupport.sol    # Base teller (~18 KB)
│   ├── TellerWithBuffer.sol               # Buffer integration (~20 KB)
│   ├── TellerWithYieldStreaming.sol       # Yield-optimized teller (~21 KB)
│   ├── AccountantWithRateProviders.sol    # Exchange rate manager (~12 KB)
│   ├── AccountantWithYieldStreaming.sol   # Yield streaming (~18 KB)
│   └── PrimeVaultFactory.sol              # Setup helper (~6 KB)
│
├── auth/
│   └── RolesAuthority.sol                 # RBAC wrapper (~6 KB)
│
├── helper/
│   ├── MockERC20.sol                      # Testing token
│   └── PrimeStrategyV1BufferHelper.sol    # Example buffer helper (~5 KB)
│
└── interfaces/
    ├── IBufferHelper.sol                  # Buffer helper interface
    ├── IBaseVault.sol                     # Vault interface
    ├── IRateProvider.sol                  # Rate provider interface
    └── hooks/
        └── BeforeTransferHook.sol         # Transfer hook interface

ignition/modules/                          # Hardhat Ignition deployment
├── Vault.ts                               # Deploy BoringVault
├── Accountant.ts                          # Deploy AccountantWithYieldStreaming
├── Teller.ts                              # Deploy TellerWithYieldStreaming
├── RolesAuthority.ts                      # Deploy RolesAuthority
└── PrimeVaultFactory.ts                   # Deploy PrimeVaultFactory

test/
└── Staking.ts                             # Integration tests
```

---

## 🛠 Development

### Prerequisites

- Node.js >= 18.16.0
- pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/Beraji-Labs/prime-vaults-contract.git
cd prime-vaults-contract

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

### Commands

```bash
# Compile contracts
pnpm compile

# Run tests
pnpm test

# Deploy to localhost (requires hardhat node running)
pnpm test-local

# Check contract sizes
pnpm contract-size

# Lint Solidity
pnpm lint:sol

# Lint TypeScript
pnpm lint:ts

# Fix linting issues
pnpm lint:fix

# Clean artifacts
pnpm clean
```

### Deployment

```bash
# Start local Hardhat node
pnpm hardhat node

# Deploy to localhost
pnpm run deploy --network localhost -f 00 # MockERC20
pnpm run deploy --network localhost -f 01 # RolesAuthority
pnpm run deploy --network localhost -f 02 # Vault + Accountant
pnpm run deploy --network localhost -f 03 # Teller
```

### Contract Sizes

All contracts are under the 24 KB Ethereum contract size limit:

| Contract                     | Size     | % of Limit |
| ---------------------------- | -------- | ---------- |
| TellerWithYieldStreaming     | 21.30 KB | 86.6%      |
| TellerWithBuffer             | 20.54 KB | 83.5%      |
| AccountantWithYieldStreaming | 18.39 KB | 74.7%      |
| TellerWithMultiAssetSupport  | 18.32 KB | 74.4%      |
| BoringVault                  | 15.99 KB | 65.0%      |
| AccountantWithRateProviders  | 11.92 KB | 48.5%      |
| RolesAuthority               | 5.73 KB  | 23.3%      |
| PrimeVaultFactory            | 5.69 KB  | 23.1%      |

---

## 🔒 Security

### Security Features

1. **Minimal Attack Surface**: Core vault contract is only ~100 lines
2. **Role-Based Access**: Granular permissions prevent unauthorized actions
3. **Rate Limiting**: Exchange rate updates are time-limited and bound-limited
4. **Share Lock Periods**: Prevents flashloan attacks and MEV
5. **TWAS Validation**: Yield vests must be reasonable relative to supply
6. **Pausability**: Emergency pause functionality for Teller and Accountant
7. **Reentrancy Protection**: All external calls use ReentrancyGuard
8. **Transfer Hooks**: Custom transfer restrictions for compliance

### Architecture Benefits

- **Separation of Concerns**: Strategy logic isolated from core vault
- **Upgradeability**: External modules can be replaced without touching vault
- **Auditability**: Each component is independently auditable
- **Composability**: Vault shares can be used in other DeFi protocols

### Audits

_Audits pending_

---

## 📚 Additional Resources

- **Veda Documentation**: https://docs.veda.tech/
- **BoringVault Architecture**: https://docs.veda.tech/architecture-and-flow-of-funds
- **Original BoringVault**: https://github.com/Veda-Labs/boring-vault

---

## 📄 License

This project is licensed under MIT.

---

## 👥 Authors

**PrimeVaults Team**  
© 2025 PrimeVaults

Built with ❤️ using Hardhat, Viem, and Solidity ^0.8.30
