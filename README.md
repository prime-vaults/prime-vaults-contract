# Prime Vaults

A modular DeFi vault system enabling users to deposit assets, receive vault shares, and earn passive income through automated strategy execution and
multi-reward distribution.

## Overview

Prime Vaults is built on the **BoringVault architecture** and provides:

- **Strategy Execution** - Automated DeFi operations (lending, farming, swaps)
- **Multi-Reward Distribution** - Automatic reward accrual to share holders
- **Time-Locked Withdrawals** - Security protection against flash attacks
- **Platform Fees** - Time-based fee accrual with transparent accounting

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRIME VAULTS ECOSYSTEM                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │BoringVault  │◄─────┤ Accountant   │◄─────┤ Teller       │   │
│  │(ERC20 Vault)│      │(Rates & Fees)│      │(Gateway)     │   │
│  └──────┬──────┘      └──────────────┘      └──────────────┘   │
│         │                                                        │
│         │                                                        │
│  ┌──────▼──────┐      ┌──────────────┐      ┌──────────────┐   │
│  │ Manager     │      │DelayedWithdraw│     │ Distributor  │   │
│  │(Strategy)   │      │(Time-lock)    │     │(Rewards)     │   │
│  └─────────────┘      └──────────────┘      └──────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           PrimeRBAC (Role-Based Access Control)           │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component           | Purpose                        | Documentation                          |
| ------------------- | ------------------------------ | -------------------------------------- |
| **BoringVault**     | Asset custody & ERC20 shares   | [Details](./BORINGVAULT_README.md)     |
| **Accountant**      | Exchange rates & platform fees | [Details](./ACCOUNTANT_README.md)      |
| **Teller**          | Deposit/withdrawal gateway     | [Details](./TELLER_README.md)          |
| **Manager**         | Strategy execution             | [Details](./MANAGER_README.md)         |
| **DelayedWithdraw** | Time-locked withdrawals        | [Details](./DELAYEDWITHDRAW_README.md) |
| **Distributor**     | Multi-token rewards            | [Details](./DISTRIBUTOR_README.md)     |

---

## Key Concepts

### ERC20 Vault Shares

Users deposit assets (USDC, WBTC, etc.) and receive proportional ERC20 vault shares. Share value appreciates as the vault generates yield through DeFi
strategies.

**Exchange Rate Formula:**

```
shareValue = (totalAssets - feesOwed) / totalShares
```

### Merkle-Verified Strategies

All vault operations (Aave deposits, Uniswap swaps, etc.) must be pre-approved via Merkle tree verification. This whitelist approach prevents unauthorized asset
movements.

### Promise-Based Rewards

The Distributor uses a promise-based model where admins notify reward amounts first, then deposit tokens later. This improves capital efficiency while tracking
reward debt.

### Time-Locked Security

Deposits are share-locked for 1 day to prevent flash loan attacks. Withdrawals require a 3-day delay (or pay expedited fee) to allow emergency response time.

---

## User Flows

### Deposit Flow

```

1. User approves asset transfer to Teller
2. Teller calls Accountant to get current exchange rate
3. Teller calculates shares to mint (asset amount / rate)
4. Vault mints shares to user (locked for 1 day)
5. User automatically starts earning rewards

```

### Withdrawal Flow

```

1. User requests withdrawal via DelayedWithdraw
2. Current exchange rate is locked for the request
3. After 3-day maturity, user completes withdrawal
4. Vault burns shares and transfers assets to user

```

### Strategy Execution Flow

````

1. Admin generates Merkle proof for desired operation
2. Manager verifies proof against stored root
3. Decoder validates and sanitizes transaction data
4. Vault executes operation (e.g., Aave deposit)
5. Total supply invariant check ensures no share dilution

---

## Deployment

### Berachain Testnet (bepolia)

Deployment artifacts available in:
- `ignition/deployments/bepolia-usd/`
- `ignition/deployments/bepolia-btc/`

---

## Role-Based Access Control

**Key Roles:**
- `PUBLIC` - User deposits/withdrawals
- `SOLVER_ROLE` - Bulk operations (market makers)
- `MINTER_ROLE` / `BURNER_ROLE` - Share minting/burning
- `MANAGER_ROLE` - Strategy execution
- `UPDATE_EXCHANGE_RATE_ROLE` - Rate updates
- `ADMIN_ROLE` - Pause & configuration

See component documentation for detailed permission matrices.

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
````

**Example**: `PrimeStrategyV1BufferHelper` automatically deposits assets into a strategy manager contract.

---

### 4. **AccountantProviders**

_Exchange rate and fee management_

- **Purpose**: Provides share pricing and fee accounting
- **Size**: ~12 KB
- **Core Responsibilities**:
  - Maintains exchange rate (vault shares → underlying assets)
  - Calculates platform fees based on time and assets
  - Manages fee accrual and distribution
  - Pauses vault if needed
  - Updates exchange rate to reflect fees owed

**State Structure**:

```solidity
struct AccountantState {
  address payoutAddress; // Where fees are sent
  uint128 feesOwedInBase; // Pending fee amount
  uint128 totalSharesLastUpdate; // Share supply snapshot
  uint96 exchangeRate; // Current rate (starts at 1:1)
  uint64 lastUpdateTimestamp; // Last update time
  bool isPaused; // Pause state
  uint16 platformFee; // Annual platform fee (bps)
}
```

**Fee Calculation**:

- **Platform Fee**: `(assets * platformFee * timeDelta) / (1e4 * 365 days)`
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

### 8. **DelayedWithdraw**

_Secure delayed withdrawal system_

- **Purpose**: Implements delayed withdrawal mechanism with configurable waiting periods
- **Size**: TBD
- **Key Features**:
  - Delayed withdrawal requests (configurable delay period)
  - Completion window to prevent indefinite pending requests
  - Withdrawal fees support
  - Third-party completion option
  - Exchange rate locked at request time (no rewards after request)
  - Admin controls for emergency situations

**State Management**:

```solidity
struct WithdrawAsset {
  bool allowWithdraws; // Toggle withdrawals
  uint32 withdrawDelay; // Delay before completion (e.g., 7 days)
  uint128 outstandingShares; // Total pending withdrawal shares
  uint16 withdrawFee; // Fee in basis points
}

struct WithdrawRequest {
  bool allowThirdPartyToComplete; // Allow others to complete
  uint40 maturity; // When withdrawal can be completed
  uint96 shares; // Shares to withdraw
  uint96 exchangeRateAtTimeOfRequest; // Locked exchange rate
}
```

**Withdrawal Flow**:

1. **Request**: User calls `requestWithdraw()` → Shares transferred to contract, exchange rate locked
2. **Wait Period**: Must wait for `withdrawDelay` seconds (e.g., 7 days)
3. **Complete**: User calls `completeWithdraw()` anytime after maturity → Receives assets at locked rate (minus fees)
4. **Cancel**: User can cancel anytime before completion to get shares back

**Key Functions**:

- `requestWithdraw()`: Initiate withdrawal request
- `completeWithdraw()`: Complete matured withdrawal
- `cancelWithdraw()`: Cancel pending withdrawal
- `setupWithdrawAsset()`: Admin setup for supported asset
- `cancelUserWithdraw()`: Admin emergency cancel
- `completeUserWithdraw()`: Admin force complete

**Important**: Once withdrawal is requested, shares are locked and **no longer earn yield**. The exchange rate is frozen at the time of request.

---

### 9. **PrimeVaultFactory**

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

## Role-Based Access Control

**Key Roles:**

- `PUBLIC` - User deposits/withdrawals
- `SOLVER_ROLE` - Bulk operations (market makers)
- `MINTER_ROLE` / `BURNER_ROLE` - Share minting/burning
- `MANAGER_ROLE` - Strategy execution
- `UPDATE_EXCHANGE_RATE_ROLE` - Rate updates
- `ADMIN_ROLE` - Pause & configuration

See component documentation for detailed permission matrices.

---

## 📁 Contract Structure

```
contracts/
├── core/
│   ├── BoringVault.sol                    # Minimal vault core (~16 KB)
│   ├── Teller.sol                         # Base teller (~18 KB)
│   ├── TellerWithBuffer.sol               # Buffer integration (~20 KB)
│   ├── AccountantProviders.sol            # Exchange rate manager (~12 KB)
│   ├── DelayedWithdraw.sol                # Delayed withdrawal system
│   ├── Distributor.sol                    # Reward distribution
│   └── PrimeRegistry.sol                  # Registry and RBAC setup
│
├── auth/
│   ├── PrimeAuth.sol                      # Base auth contract
│   ├── PrimeRBAC.sol                      # RBAC implementation
│   └── RolesAuthority.sol                 # Role authority (~6 KB)
│
├── helper/
│   ├── MockERC20.sol                      # Testing token
│   └── PrimeBufferHelper.sol              # Buffer helper (~5 KB)
│
└── interfaces/
    ├── IBufferHelper.sol                  # Buffer helper interface
    ├── IBaseVault.sol                     # Vault interface
    └── hooks/
        └── IBeforeUpdateHook.sol          # Transfer hook interface

ignition/modules/                          # Hardhat Ignition deployment
├── vault/
│   ├── Vault.ts                           # Deploy BoringVault
│   ├── Accountant.ts                      # Deploy AccountantProviders
│   ├── Teller.ts                          # Deploy TellerWithBuffer
│   └── TellerHelper.ts                    # Deploy PrimeBufferHelper
├── PrimeRegistry.ts                       # Deploy PrimeRegistry
└── Distributor.ts                         # Deploy Distributor

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

| Contract            | Size     | % of Limit |
| ------------------- | -------- | ---------- |
| TellerWithBuffer    | 20.54 KB | 83.5%      |
| Teller              | 18.32 KB | 74.4%      |
| BoringVault         | 15.99 KB | 65.0%      |
| AccountantProviders | 11.92 KB | 48.5%      |
| Distributor         | ~10 KB   | ~40%       |
| DelayedWithdraw     | ~8 KB    | ~33%       |
| PrimeRegistry       | ~6 KB    | ~25%       |
| RolesAuthority      | 5.73 KB  | 23.3%      |

---

## 🔒 Security

### Security Features

1. **Minimal Attack Surface**: Core vault contract is only ~100 lines
2. **Role-Based Access**: Granular permissions prevent unauthorized actions
3. **Share Lock Periods**: Prevents flashloan attacks and MEV
4. **Pausability**: Emergency pause functionality for Teller and Accountant
5. **Reentrancy Protection**: All external calls use ReentrancyGuard
6. **Fee Management**: Platform fees tracked and claimed separately
7. **Merkle Verification**: Manager actions verified through Merkle proofs
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
