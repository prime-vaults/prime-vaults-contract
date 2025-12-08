# Teller - Deposit & Withdrawal Gateway

## Purpose

**Teller** is the **main gateway** for users to interact with the vault. This contract handles deposits, withdrawals, and manages constraints such as share lock
period and deposit cap.

## Role in Ecosystem

Teller serves as the **user interface**:

- **Deposit handler**: Receives assets from user, mints shares via BoringVault
- **Withdrawal handler**: Burns shares, returns assets to user
- **Access control**: Controls who can deposit/withdraw
- **Rate coordination**: Calls Accountant to get exchange rate for each transaction
- **Reward integration**: Triggers Distributor to update rewards via hook

## Core Functions

### 1. User Deposits

```solidity
function deposit(uint256 depositAmount, uint256 minimumMint, address to)
    external returns (uint256 shares)
```

**Flow**:

1. Check `allowDeposits` enabled
2. Update exchange rate from Accountant
3. Calculate shares: `shares = depositAmount * ONE_SHARE / exchangeRate`
4. Check `minimumMint` slippage protection
5. Check `depositCap` is not exceeded
6. Call `vault.enter()` to mint shares
7. Lock shares if `shareLockPeriod > 0`

**Example**:

```javascript
// User deposits 100 USDC when rate = 1.1 USDC/share
depositAmount = 100e6  // 100 USDC
exchangeRate = 1.1e6   // 1.1 USDC per share
shares = 100e6 * 1e18 / 1.1e6 = 90.909e18  // ~90.9 shares
```

### 2. User Withdrawals

```solidity
function withdraw(uint256 shareAmount, uint256 minimumAssets, address to)
    external returns (uint256 assetsOut)
```

**Flow**:

1. Check `allowWithdraws` enabled and not paused
2. Update exchange rate
3. Calculate assets: `assetsOut = shareAmount * exchangeRate / ONE_SHARE`
4. Check `minimumAssets` slippage protection
5. Call `vault.exit()` to burn shares
6. Transfer assets to user

### 3. Bulk Operations (Solver Role)

```solidity
function bulkDeposit(uint256 depositAmount, uint256 minimumMint, address to)
function bulkWithdraw(uint256 shareAmount, uint256 minimumAssets, address to)
```

- Reserved for **SOLVER_ROLE** (market makers, liquidators)
- Bypasses share lock period
- Has separate events (emits BulkDeposit/BulkWithdraw)

## State Management

### TellerState Struct

```solidity
struct TellerState {
  bool allowDeposits; // Enable/disable deposits
  bool allowWithdraws; // Enable/disable withdrawals
  uint64 shareLockPeriod; // Lock shares after deposit (max 7 days)
  uint112 depositCap; // Global deposit limit (in shares)
}
```

### BeforeTransferData Mapping

```solidity
mapping(address => BeforeTransferData) public beforeTransferData;

struct BeforeTransferData {
    uint256 shareUnlockTime;  // Timestamp when shares are unlocked
}
```

## Roles & Permissions

| Role               | Permission                                                         | Use Case                |
| ------------------ | ------------------------------------------------------------------ | ----------------------- |
| **Public**         | `deposit()` nếu allowDeposits=true                                 | Normal user deposits    |
| **Public**         | `withdraw()` nếu allowWithdraws=true                               | Normal user withdrawals |
| **SOLVER_ROLE**    | `bulkDeposit()`, `bulkWithdraw()`                                  | Market makers, MEV bots |
| **PROTOCOL_ADMIN** | Config: allowDeposits, allowWithdraws, shareLockPeriod, depositCap | Admin operations        |
| **PROTOCOL_ADMIN** | `setDistributor()`                                                 | Set reward distributor  |

## Contract Interactions

### 1. **BoringVault** (Vault Operations)

```
Teller.deposit() → accountant.updateExchangeRate()
                → vault.enter(user, assets, to, shares)
                → Mint shares to user
```

### 2. **AccountantProviders** (Exchange Rate)

```
Every deposit/withdraw → accountant.updateExchangeRate()
                      → accountant.getRate()
                      → Use rate for share calculation
```

### 3. **Distributor** (Reward Updates)

```
vault.enter() → vault._callBeforeUpdate()
             → Teller.beforeUpdate()
             → distributor.updateRewardForAccount(to)
             → Update rewards BEFORE balance changes
```

## Deposit Cap Mechanism

**Purpose**: Limits total TVL to control risk

```solidity
if (tellerState.depositCap != type(uint112).max) {
    uint256 totalSharesAfterDeposit = shares + vault.totalSupply();
    if (totalSharesAfterDeposit > depositCap) {
        revert Teller__DepositExceedsCap();
    }
}
```

**Example**:

- Deposit cap = 1,000,000 shares
- Current supply = 900,000 shares
- User deposit equivalent to 150,000 shares → **REVERT**
- User deposit equivalent to 100,000 shares → **SUCCESS**

## Share Lock Period

**Purpose**: Prevents flash loan attacks and arbitrage

```solidity
function _afterPublicDeposit(address to, uint256 assets, uint256 shares, uint64 period) {
  if (period > 0) {
    beforeTransferData[to].shareUnlockTime = block.timestamp + period;
  }
}
```

**Check on transfer**:

```solidity
function beforeUpdate(address from, address to, ...) {
    if (from != address(0) &&
        beforeTransferData[from].shareUnlockTime > block.timestamp) {
        revert Teller__SharesAreLocked();
    }
}
```

**Use Case**:

- Set `shareLockPeriod = 1 days`
- User deposits at 12:00 on day 1
- User cannot transfer shares until 12:00 on day 2
- After that can transfer freely

## BeforeUpdate Hook Implementation

```solidity
function beforeUpdate(address from, address to, uint256 amount, address operator) {
  // 1. Update rewards if distributor exists
  if (address(distributor) != address(0)) {
    if (from != address(0)) {
      distributor.updateRewardForAccount(from);
    }
    if (to != address(0)) {
      distributor.updateRewardForAccount(to);
    }
  }

  // 2. Check share lock
  if (from != address(0) && beforeTransferData[from].shareUnlockTime > block.timestamp) {
    revert Teller__SharesAreLocked();
  }
}
```

## Deposit Flow Diagram

```
┌──────────┐
│   User   │
└────┬─────┘
     │ deposit(100 USDC, 90 shares, user)
     ▼
┌────────────────────────────┐
│        Teller              │
│  1. Check allowDeposits    │
│  2. accountant.update()    │
│  3. Calculate shares       │
│  4. Check depositCap       │
└────────┬───────────────────┘
         │ vault.enter(user, 100 USDC, user, 90.9 shares)
         ▼
┌──────────────────────────────┐
│      BoringVault             │
│  1. Transfer 100 USDC in     │
│  2. beforeUpdate hook        │
│  3. Mint 90.9 shares         │
└──────────────────────────────┘
```

## Slippage Protection

**Deposit**:

```solidity
if (shares < minimumMint) revert Teller__MinimumMintNotMet();
```

- User expects to receive at least `minimumMint` shares
- If exchange rate changes unfavorably → revert

**Withdrawal**:

```solidity
if (assetsOut < minimumAssets) revert Teller__MinimumAssetsNotMet();
```

- User expects to receive at least `minimumAssets`
- If exchange rate decreases → revert

## Technical Specifications

- **Single asset**: Each Teller only supports 1 asset type (vault.asset())
- **Nonreentrant**: All public functions have `nonReentrant` modifier
- **RequiresAuth**: Uses PrimeAuth for role-based access control
- **Immutable references**: vault, accountant, asset cannot be changed

## Important Notes

1. **Always update rate first**: Every operation calls `updateExchangeRate()` first
2. **Share lock only applies to public deposits**: Bulk deposits are not locked
3. **Deposit cap calculated in shares**: Not by asset amount
4. **Transfer lock only checks sender**: Receiver is not checked
5. **Distributor optional**: Can operate without Distributor
6. **Pause affects withdrawals only**: Deposits can be disabled separately via `allowDeposits`
