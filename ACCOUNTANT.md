# Accountant (AccountantProviders)

## Overview

**AccountantProviders** is the share price oracle and fee management system for BoringVault. It calculates the exchange rate (share price), accrues time-based
platform fees, and handles fee claiming.

## Core Concept

The Accountant serves two critical functions:

1. **Exchange Rate Management**: Provides the current price of vault shares in base asset terms
2. **Fee Accrual**: Calculates and tracks platform fees based on time and assets under management (AUM)

```
Share Price = (Total Assets - Fees Owed) / Total Shares
Platform Fees = AUM × Fee Rate × Time Elapsed / 365 days
```

## Architecture

```
┌─────────────────┐
│  Teller/Users   │ ← Query share price
└────────┬────────┘
         │ getRateSafe()
         ↓
┌──────────────────────┐
│  AccountantProviders │ ← Calculate share price & fees
└────────┬─────────────┘
         │ updateExchangeRate()
         ↓
┌──────────────────────┐
│   BoringVault        │ ← Read total shares
└──────────────────────┘

Fee Flow:
Manager → manage(accountant.claimFees()) → Transfer fees to payout address
```

## Key Components

### 1. Exchange Rate

The **exchange rate** represents how much base asset one vault share is worth.

**Initial Rate**: `1.0` (1 share = 1 base asset)  
**Updated Rate**: Decreases over time as fees accrue, then may increase as strategies generate yield

**Formula**:

```
newRate = (totalAssets - feesOwed) / totalShares

where:
  totalAssets = totalShares × oldRate
  feesOwed = accumulated platform fees
```

### 2. Platform Fees

Platform fees are calculated as an **annual percentage** of assets under management (AUM).

**Fee Calculation**:

```
Annual Fee = AUM × platformFee (in bps) / 10000
Time-Based Fee = Annual Fee × (timeDelta / 365 days)

Example:
  AUM = 100 tokens
  platformFee = 1000 bps (10%)
  timeDelta = 1 day
  Fee = 100 × 0.10 × (1/365) ≈ 0.0274 tokens
```

**Anti-Gaming Mechanism**:

- Uses `max(currentShares, lastShares)` to prevent fee evasion through mass withdrawals before updates

### 3. State Management

All state is packed into **3 storage slots** for gas efficiency:

| Field                   | Type    | Purpose                     |
| ----------------------- | ------- | --------------------------- |
| `payoutAddress`         | address | Fee recipient               |
| `feesOwedInBase`        | uint128 | Accumulated unclaimed fees  |
| `totalSharesLastUpdate` | uint128 | Share supply at last update |
| `exchangeRate`          | uint96  | Current share price         |
| `lastUpdateTimestamp`   | uint64  | Last update time            |
| `isPaused`              | bool    | Pause status                |
| `platformFee`           | uint16  | Annual fee in bps           |

## Role System

| Role               | Functions                                      | Purpose                            |
| ------------------ | ---------------------------------------------- | ---------------------------------- |
| **STRATEGIST**     | `updateExchangeRate()`                         | Update share price and accrue fees |
| **PROTOCOL_ADMIN** | `updatePlatformFee()`, `updatePayoutAddress()` | Configure fee                      |
| **BoringVault**    | `claimFees()` caller                           | Only vault can trigger fee claims  |

## Key Functions

### 1. `updateExchangeRate()` - Update Share Price

```solidity
function updateExchangeRate() public requiresAuth
```

**Purpose**: Calculate accrued fees and update exchange rate

**Flow**:

1. Calculate time elapsed since last update
2. Calculate platform fees: `fees = AUM × rate × timeDelta / 365 days`
3. Add fees to `feesOwedInBase`
4. Reduce exchange rate: `newRate = (assets - fees) / shares`
5. Update timestamp and total shares

**Access**: STRATEGIST_ROLE

**When Called**:

- Before deposits (to ensure users get accurate share price)
- Before withdrawals (to ensure users get accurate asset amount)
- Periodically by strategist to accrue fees

### 2. `claimFees()` - Withdraw Platform Fees

```solidity
function claimFees() external
```

**Purpose**: Transfer accumulated fees to payout address

**Flow**:

1. Must be called via `BoringVault.manage()` (enforced by `msg.sender == vault`)
2. Auto-calls `updateExchangeRate()` to get latest fees
3. Transfer `feesOwedInBase` from vault to `payoutAddress`
4. Zero out `feesOwedInBase`

**Access**: Must be called by BoringVault contract

**Prerequisites**:

- Vault must have approved Accountant to spend base asset
- Vault must have sufficient base asset balance

**Example (from test)**:

```typescript
// Step 1: Approve Accountant to spend vault's base asset
vault.manage(baseAsset, abi.encodeCall("approve", [accountant, MAX_UINT256]), 0);

// Step 2: Claim fees via Manager
vault.manage(accountant, abi.encodeCall("claimFees", []), 0);

// Result: Fees transferred to payout address
```

### 3. `getRate()` vs `getRateSafe()`

```solidity
function getRate() public view returns (uint256)
function getRateSafe() external view returns (uint256)
```

**`getRate()`**:

- Returns current exchange rate
- Works even when paused
- Used for informational purposes

**`getRateSafe()`**:

- Returns current exchange rate
- **Reverts if paused**
- Used by Teller for deposits/withdrawals (safety check)

### 4. Admin Functions

**`updatePlatformFee(uint16 platformFee)`**

- Update annual fee rate (max 20% = 2000 bps)
- Access: PROTOCOL_ADMIN_ROLE

**`updatePayoutAddress(address payoutAddress)`**

- Change fee recipient
- Access: PROTOCOL_ADMIN_ROLE

**`pause()` / `unpause()`**

## Fee Accrual Example (from Test)

### Scenario

- **Initial deposit**: 100 tokens
- **Platform fee**: 10% annual (1000 bps)
- **Time elapsed**: 1 day

### Step-by-Step

1. **Alice deposits 100 tokens**

   ```
   shares = 100 (1:1 ratio initially)
   exchangeRate = 1.0
   ```

2. **Wait 1 day, then updateExchangeRate()**

   ```
   timeDelta = 86400 seconds
   assets = 100 × 1.0 = 100
   platformFeesAnnual = 100 × 0.10 = 10
   platformFeesDaily = 10 × (1/365) ≈ 0.0274

   feesOwedInBase += 0.0274
   newRate = (100 - 0.0274) / 100 ≈ 0.9997
   ```

3. **Claim fees via vault.manage()**
   ```
   Vault approves Accountant
   Vault calls accountant.claimFees()
   → updateExchangeRate() called again (adds tiny bit more)
   → Transfer ~0.0274 tokens to payout address
   → feesOwedInBase = 0
   ```

## Security Model

### Trust Assumptions

1. **STRATEGIST**: Trusted to call `updateExchangeRate()` regularly (affects fee accuracy)
2. **PROTOCOL_ADMIN**: Trusted to set reasonable fee rates and payout addresses
3. **Rate Providers**: (Future extension) Trusted to provide accurate asset valuations

### Attack Vectors & Mitigations

| Attack Vector               | Mitigation                                               |
| --------------------------- | -------------------------------------------------------- |
| Fee evasion via withdrawals | Use `max(currentShares, lastShares)` for fee calculation |
| Excessive fee extraction    | Cap platform fee at 20% (2000 bps)                       |
| Unauthorized fee claims     | Only BoringVault can call `claimFees()`                  |
| Rate manipulation           | Pause mechanism for emergencies                          |
| Stale exchange rates        | Teller uses `getRateSafe()` which reverts if paused      |

### Critical Invariants

1. **Fee Accuracy**: `feesOwedInBase` always reflects time-based accrual since last update
2. **Exchange Rate**: Always decreases when fees accrue, never negative
3. **Claim Safety**: Fees only transferred when explicitly claimed via vault
4. **State Consistency**: Updates are atomic (all state changes in one transaction)

## Deployment (Hardhat Ignition)

The `Accountant.ts` module deploys AccountantProviders with proper roles:

### Deployment Steps

1. **Deploy AccountantProviders**
   - Link to BoringVault for share supply queries
   - Set initial payout address and platform fee

2. **Configure Role Capability** (sequential)
   - Grant STRATEGIST role permission to call `updateExchangeRate()`

3. **Assign Roles to Accountant**
   - MINTER: (Reserved for future use)
   - ADMIN: Administrative privileges
   - STRATEGIST: Can update exchange rates

### Why Sequential Execution?

Each `m.call()` uses the `after` parameter to ensure proper configuration order and prevent race conditions.

## Integration Pattern

### Teller Deposit Flow

```solidity
// 1. Get current share price from Accountant
uint256 rate = accountant.getRateSafe(); // Reverts if paused

// 2. Calculate shares to mint
uint256 shares = assets.mulDivDown(ONE_SHARE, rate);

// 3. Mint shares via BoringVault
vault.enter(user, assets, user, shares);
```

### Teller Withdrawal Flow

```solidity
// 1. Get current share price
uint256 rate = accountant.getRateSafe();

// 2. Calculate assets to return
uint256 assets = shares.mulDivDown(rate, ONE_SHARE);

// 3. Burn shares and transfer assets
vault.exit(user, assets, user, shares);
```

### Manager Fee Claiming

```solidity
// 1. Approve Accountant (one-time, via Merkle proof)
manager.manageVaultWithMerkleVerification(
  proof,
  decoder,
  baseAsset,
  approveCalldata,
  0
);

// 2. Claim fees (via Merkle proof)
manager.manageVaultWithMerkleVerification(
  proof,
  decoder,
  accountant,
  claimFeesCalldata,
  0
);
```

## Related Contracts

- **BoringVault**: Custody contract that queries exchange rate and calls `claimFees()`
- **TellerWithBuffer**: Uses `getRateSafe()` for deposit/withdrawal calculations
- **ManagerWithMerkleVerification**: Executes `claimFees()` via validated `manage()` calls
- **PrimeAuth**: Provides role-based access control
- **RolesAuthority**: RBAC system for permission management

## Files

- **Contract**: `contracts/core/AccountantProviders.sol`
- **Deployment**: `ignition/modules/vault/Accountant.ts`
- **Test**: `test/04_ClaimFees.ts`
