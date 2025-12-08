# DelayedWithdraw - Time-locked Withdrawal System

## Purpose

**DelayedWithdraw** provides a **time-locked withdrawal system** to protect the vault from sudden attacks and allow admins time to respond to suspicious
activity.

## Role in Ecosystem

DelayedWithdraw is the **withdrawal protection layer**:

- **Time-lock enforcement**: Enforces delay before withdrawal
- **Emergency brake**: Admin can pause or cancel withdrawals
- **Fee collector**: Collects withdrawal and expedited withdrawal fees
- **Exchange rate lock**: Locks price at request time, unaffected by subsequent changes

## Core Functions

### 1. Request Withdrawal

```solidity
function requestWithdraw(uint96 shares, bool allowThirdPartyToComplete)
    external returns (uint256 assets)
```

**Flow**:

1. Check not paused
2. Check withdrawal has been setup (`withdrawDelay != 0`)
3. Check user has no pending request
4. Update exchange rate to get current price
5. Calculate assets to receive = `shares * exchangeRate / ONE_SHARE`
6. Calculate fee = `assets * withdrawFee / 10000`
7. Create `WithdrawRequest`:
   - `maturity` = `block.timestamp + withdrawDelay`
   - `exchangeRateAtTimeOfRequest` = current rate
   - `sharesFee` = fee in shares
8. Update `outstandingShares` += shares
9. Emit `WithdrawRequested`

**Example**:

```javascript
// Config: withdrawDelay = 3 days, withdrawFee = 100 (1%)
// User requests withdrawal of 100 shares when rate = 1.1 USDC/share

shares = 100e18
rate = 1.1e6
assets = 100e18 * 1.1e6 / 1e18 = 110e6 USDC
fee = 110e6 * 100 / 10000 = 1.1e6 USDC (1%)
sharesFee = 1.1e6 * 1e18 / 1.1e6 = 1e18 shares

maturity = now + 3 days
```

### 2. Complete Withdrawal

```solidity
function completeWithdraw(address account) external nonReentrant
```

**Flow**:

1. Check not paused
2. Get user's `WithdrawRequest`
3. Check `maturity <= block.timestamp` (delay has elapsed)
4. Check third-party authorization if caller != user
5. Calculate actual assets and fee:
   - `totalAssets = shares * lockedExchangeRate / ONE_SHARE`
   - `fee = sharesFee * lockedExchangeRate / ONE_SHARE`
   - `assetsToUser = totalAssets - fee`
6. Delete withdraw request
7. Update `outstandingShares` -= shares
8. Call `vault.exit()` to burn shares
9. Transfer assets to user
10. Transfer fee to `feeAddress`
11. Emit `WithdrawCompleted`

### 3. Expedited Withdrawal (Accelerate)

```solidity
function accelerateWithdraw(uint96 shares) external nonReentrant
```

**Purpose**: User pays fee to reduce delay to 1 day

**Flow**:

1. Get existing request
2. Check not yet matured
3. Check shares match (cannot partially accelerate)
4. Calculate expedited fee = `assets * expeditedWithdrawFee / 10000`
5. Update maturity = `block.timestamp + 1 day`
6. Update `sharesFee` += expedited fee shares
7. Emit `ExpeditedWithdrawFeePaid`

**Example**:

```javascript
// Original: delay = 7 days, withdrawFee = 1%
// Expedited: delay = 1 day, expeditedWithdrawFee = 5%

// User wants to withdraw 6 days early → pays additional 5% fee
totalFee = 1% + 5% = 6%
newMaturity = now + 1 day (instead of now + 7 days)
```

### 4. Cancel Withdrawal

```solidity
function cancelWithdraw() external nonReentrant  // User cancel
function cancelUserWithdraw(address user) external onlyOperator  // Admin cancel
```

**Flow**:

1. Get withdraw request
2. Delete request
3. Update `outstandingShares` -= shares
4. Emit `WithdrawCancelled`

## State Management

### WithdrawState Struct

```solidity
struct WithdrawState {
  uint32 withdrawDelay; // Delay time (seconds)
  uint128 outstandingShares; // Total pending withdrawal shares
  uint16 withdrawFee; // Base withdraw fee (basis points)
  uint16 expeditedWithdrawFee; // Expedited fee (basis points)
}
```

### WithdrawRequest Struct

```solidity
struct WithdrawRequest {
  bool allowThirdPartyToComplete; // Allow others to complete
  uint40 maturity; // Timestamp when withdrawal is allowed
  uint96 shares; // Number of shares to withdraw
  uint96 exchangeRateAtTimeOfRequest; // Exchange rate at request time
  uint96 sharesFee; // Fee (in shares)
}
```

## Roles & Permissions

| Role                   | Permission                              | Use Case                |
| ---------------------- | --------------------------------------- | ----------------------- |
| **Public**             | `requestWithdraw()`, `cancelWithdraw()` | User operations         |
| **Public/Third-party** | `completeWithdraw()`                    | Complete after maturity |
| **PROTOCOL_ADMIN**     | Setup & config functions                | Admin management        |
| **OPERATOR**           | `cancelUserWithdraw()`                  | Emergency intervention  |

## Contract Interactions

### 1. **BoringVault** (Burn Shares)

```
User complete withdraw → DelayedWithdraw.completeWithdraw()
                      → vault.exit(user, assets, user, shares)
                      → Burn shares + transfer assets
```

### 2. **AccountantProviders** (Exchange Rate)

```
Request withdraw → DelayedWithdraw.requestWithdraw()
                → accountant.updateExchangeRate()
                → accountant.getRate()
                → Lock rate in WithdrawRequest
```

### 3. **Teller** (Alternative Withdrawal Path)

```
If DelayedWithdraw paused → Use Teller.withdraw() directly
                          → Instant withdrawal if allowWithdraws=true
```

## Fee Calculation Examples

### Scenario 1: Normal Withdrawal

```javascript
// Config: withdrawDelay = 3 days, withdrawFee = 100 (1%)
// User: 100 shares, rate = 1.0 USDC

assets = 100 * 1.0 = 100 USDC
fee = 100 * 0.01 = 1 USDC
userReceives = 99 USDC
feeAddress receives = 1 USDC
```

### Scenario 2: Expedited Withdrawal

```javascript
// Config: withdrawFee = 100 (1%), expeditedWithdrawFee = 500 (5%)
// User: 100 shares, rate = 1.0 USDC

// Step 1: Request (normal fee)
normalFee = 100 * 0.01 = 1 USDC

// Step 2: Accelerate (expedited fee)
expeditedFee = 100 * 0.05 = 5 USDC

// Step 3: Complete (total fee)
totalFee = 1 + 5 = 6 USDC
userReceives = 100 - 6 = 94 USDC
```

## Exchange Rate Lock Mechanism

**Purpose**: Protects user from exchange rate decreases during delay period

```solidity
// At request time (rate = 1.0)
request.exchangeRateAtTimeOfRequest = 1.0e6;

// 3 days later, rate drops to 0.9
// User still receives at rate = 1.0 (protected)

assets = shares * 1.0e6 / 1e18;  // Uses locked rate
```

**Example**:

- T0: Request 100 shares @ 1.0 USDC/share = 100 USDC
- T3: Complete withdrawal, current rate = 0.95 USDC/share
- User receives: 100 USDC (locked rate), not 95 USDC

## Third-Party Complete

**Use Case**: Automation, keeper bots

```solidity
function requestWithdraw(uint96 shares, bool allowThirdPartyToComplete)
```

**If allowThirdPartyToComplete = true**:

- Anyone can call `completeWithdraw(user)` after maturity
- Useful for automation services
- User receives assets at their address

**If allowThirdPartyToComplete = false**:

- Only user can complete
- Higher security

## Withdrawal Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ Step 1: Request Withdrawal                      │
│  - User calls requestWithdraw(100 shares)       │
│  - Lock exchange rate = 1.0                     │
│  - Set maturity = now + 3 days                  │
│  - Calculate fee = 1%                           │
└─────────────────────────────────────────────────┘
                      │
                      │ Wait 3 days
                      ▼
┌─────────────────────────────────────────────────┐
│ Step 2: Complete Withdrawal                     │
│  - User calls completeWithdraw()                │
│  - Check maturity reached                       │
│  - Burn shares via vault.exit()                 │
│  - Transfer 99 USDC to user                     │
│  - Transfer 1 USDC fee to feeAddress            │
└─────────────────────────────────────────────────┘
```

## Emergency Mechanisms

### 1. Pause Withdrawals

```solidity
// Inherited from PrimeAuth
function pause() external onlyProtocolAdmin
```

- Blocks `requestWithdraw()` and `completeWithdraw()`
- Users can cancel existing requests
- Emergency brake for suspicious activity

### 2. Cancel User Withdrawals

```solidity
function cancelUserWithdraw(address user) external onlyOperator
```

- Admin can cancel any request
- Used when malicious behavior is detected
- User gets shares back (no loss)

## Technical Specifications

- **One request per user**: User can only have 1 pending request
- **Non-transferable requests**: Cannot transfer withdraw request
- **Immutable setup**: `withdrawDelay` cannot be changed after setup (can only be changed later)
- **Fee precision**: Fees calculated in basis points (10000 = 100%)

## Important Notes

1. **Exchange rate locked**: User is protected from rate decreases during delay period
2. **Single request limitation**: Must complete/cancel before making new request
3. **Expedited not partial**: Must accelerate entire request
4. **Maturity check strict**: Must wait exact time, no earlier
5. **Fee paid in shares**: Fee is calculated in shares, not assets
6. **Outstanding shares tracking**: Vault must ensure sufficient liquidity for pending withdrawals
