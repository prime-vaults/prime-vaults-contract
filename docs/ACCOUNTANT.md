# AccountantProviders - Exchange Rate & Fee Management

## Purpose

**AccountantProviders** manages the **exchange rate** (share → asset conversion) and **platform fees**. This contract ensures share value accurately reflects
vault assets and automatically calculates time-based management fees.

## Role in Ecosystem

AccountantProviders is the **financial brain** of the system:

- **Pricing oracle**: Provides exchange rate for all deposits/withdrawals
- **Fee calculator**: Calculates and accrues time-based management fees
- **Performance tracker**: Adjusts share price as assets appreciate/depreciate

## Core Functions

### 1. Exchange Rate Management

```solidity
function updateExchangeRate() public virtual requiresAuth
function getRate() public view virtual returns (uint256)
function getRateSafe() external view virtual returns (uint256)
```

**Exchange rate formula**:

```
newRate = (totalAssets - feesOwed) / totalShares

totalAssets = totalShares * oldExchangeRate

Note: Only updates lastUpdateTimestamp if fees > 0 to prevent fee loss from frequent updates
```

**Example**:

- Initial: 1 share = 1 USDC (rate = 1e6)
- After 1 year with 10% APY: 1 share = 1.1 USDC (rate = 1.1e6)
- After deducting 2% platform fee: 1 share = 1.078 USDC (rate = 1.078e6)

### 2. Platform Fee Calculation

```solidity
function _calculatePlatformFee(...) internal view returns (uint256)
```

**Fee formula**:

```
fee = (shareSupply * exchangeRate * platformFee * timeDelta) / (10000 * 365 days)

Example: 10% platform fee, $1M TVL, 30 days
fee = (1M * 0.10 * 30) / 365 = ~$8,219
```

**Anti-gaming mechanism**:

- Uses `max(currentShares, lastUpdateShares)` to prevent fee evasion via withdrawals
- Fees accumulate over time, don't reset on update

### 3. Fee Claiming

```solidity
function claimFees() external
```

- **MUST** be called from `BoringVault.manage()` (msg.sender == vault)
- Automatically updates exchange rate before claiming
- Transfers base asset from vault → payout address
- Zeros out fees owed after claim

## State Management

### AccountantState Struct (3 storage slots)

```solidity
struct AccountantState {
  address payoutAddress; // Fee recipient
  uint96 exchangeRate; // Current price (base per share)
  uint128 feesOwedInBase; // Accumulated unclaimed fees
  uint128 totalSharesLastUpdate; // Total shares at last update
  uint64 lastUpdateTimestamp; // Last update timestamp
  uint16 platformFee; // Annual fee (basis points: 1000 = 10%)
}
```

## Roles & Permissions

| Role                | Permission                                     | Use Case                           |
| ------------------- | ---------------------------------------------- | ---------------------------------- |
| **STRATEGIST_ROLE** | `updateExchangeRate()`                         | Update price after managing assets |
| **PROTOCOL_ADMIN**  | `updatePlatformFee()`, `updatePayoutAddress()` | Change fee configuration           |
| **BoringVault**     | `claimFees()`                                  | Only vault can claim fees          |

## Contract Interactions

### 1. **Teller** (Exchange Rate Consumer)

```
User deposit → Teller.deposit()
            → accountant.updateExchangeRate()
            → accountant.getRate()
            → Calculate shares = depositAmount / rate
```

### 2. **DelayedWithdraw** (Exchange Rate Consumer)

```
User request withdraw → DelayedWithdraw.requestWithdraw()
                     → accountant.getRate()
                     → Lock exchange rate for maturity
```

### 3. **Manager** (Fee Claimer)

```
Admin claim fees → Manager.manageVaultWithMerkleVerification()
                → vault.manage(accountant, "claimFees()", 0)
                → accountant.claimFees()
                → Transfer fees to payout address
```

## Exchange Rate Update Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. Strategist calls updateExchangeRate()            │
└─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ 2. Calculate platform fees based on time elapsed    │
│    fee = (shares * rate * platformFee * Δt) / 365d  │
└─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ 3. Update exchange rate                             │
│    newRate = (totalAssets - feesOwed) / totalShares │
└─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ 4. Save state: feesOwed, lastUpdate, totalShares    │
└─────────────────────────────────────────────────────┘
```

## Important Notes

1. **Must update before operations**: Teller/DelayedWithdraw must call `updateExchangeRate()` before deposit/withdraw
2. **Rate never increases from fees**: Fees only decrease rate, never increase
3. **Fee claiming requires approval**: Vault must approve accountant to spend base asset
4. **Paused state**: All operations fail if contract is paused
5. **Share supply gaming prevention**: Uses max(current, last) to prevent fee evasion

## Audit Findings & Bug Fixes

### Bug Fix: Platform Fees Timestamp Update Logic

**Issue (Audit Bug #6)**: Platform fees may be rounded down to 0

**Fix**: The contract now only updates `lastUpdateTimestamp` if fees are actually accrued:

```solidity
if (newFeesOwedInBase > 0) {
    state.feesOwedInBase += uint128(newFeesOwedInBase);
    state.lastUpdateTimestamp = currentTime;  // Only update if fees > 0
}
```

**Impact**: Prevents fee loss when users deposit/withdraw frequently. Small time periods that would round to 0 fees are accumulated until the next period where fees > 0.
