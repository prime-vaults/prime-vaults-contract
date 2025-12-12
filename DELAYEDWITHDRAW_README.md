# DelayedWithdraw - Time-locked Withdrawal System

## Purpose

**DelayedWithdraw** provides a **time-locked withdrawal system** to protect the vault from sudden attacks and allow admins time to respond to suspicious
activity.

## Role in Ecosystem

DelayedWithdraw is the **withdrawal protection layer**:

- **Time-lock enforcement**: Enforces delay before withdrawal
- **Emergency brake**: Admin can pause or cancel withdrawals
- **Fee collector**: Collects withdrawal and expedited withdrawal fees

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
4. Calculate fee = `shares * withdrawFee / 10000`
5. Create `WithdrawRequest`:
   - `maturity` = `block.timestamp + withdrawDelay`
   - `sharesFee` = fee in shares
6. Update `outstandingShares` += shares
7. Emit `WithdrawRequested`

**Example**:

```javascript
// Config: withdrawDelay = 3 days, withdrawFee = 100 (1%)
// User requests withdrawal of 100 shares

shares = 100e18
fee = 100e18 * 100 / 10000 = 1e18 shares (1%)

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
5. Calculate assets using current exchange rate:
   - Update exchange rate via `accountant.updateExchangeRate()`
   - `assetsOut = shares * currentRate / ONE_SHARE`
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
│  - Calculate fee = 1%                           │
│  - Set maturity = now + 3 days                  │
└─────────────────────────────────────────────────┘
                      │
                      │ Wait 3 days
                      ▼
┌─────────────────────────────────────────────────┐
│ Step 2: Complete Withdrawal                     │
│  - User calls completeWithdraw()                │
│  - Check maturity reached                       │
│  - Get current exchange rate                    │
│  - Calculate assets from shares                 │
│  - Burn shares via vault.exit()                 │
│  - Transfer assets to user                      │
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

1. **Single request limitation**: Must complete/cancel before making new request
2. **Expedited not partial**: Must accelerate entire request
3. **Maturity check strict**: Must wait exact time, no earlier
4. **Fee paid in shares**: Fee is calculated in shares, not assets
5. **Outstanding shares tracking**: Vault must ensure sufficient liquidity for pending withdrawals
