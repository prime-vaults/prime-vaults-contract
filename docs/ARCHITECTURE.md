# Prime Vaults - Complete Architecture Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Philosophy](#core-philosophy)
3. [Component Architecture](#component-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Governance & Decentralization](#governance--decentralization)
6. [Security Model](#security-model)
7. [Integration Guide](#integration-guide)

---

## System Overview

### What is Prime Vaults?

Prime Vaults is a **modular DeFi vault infrastructure** that enables users to:
- Deposit assets (USDC, WETH, WBTC, etc.) and receive ERC20 vault shares
- Earn passive yield through automated DeFi strategy execution
- Receive multiple types of reward tokens via integrated distribution system
- Withdraw assets with optional time-lock security delays

### Key Problems Solved

| Problem | Solution |
|---------|----------|
| **Complexity** | Modular architecture - each component has single responsibility |
| **Security** | Merkle-verified strategies + minimal vault attack surface |
| **Flash Loan Attacks** | Share locking + time-delayed withdrawals |
| **Reward Distribution** | Automatic accrual via share balance tracking (no staking needed) |
| **Fee Transparency** | Time-based platform fees encoded in exchange rate |
| **Governance Risk** | PrimeTimelock (48h delay) + Multi-sig governance |

---

## Core Philosophy

### Separation of Concerns

```
┌──────────────────────────────────────────────────────────────┐
│                    Prime Vaults Ecosystem                     │
│                                                              │
│  ┌─────────────┐         ┌──────────────┐                   │
│  │BoringVault  │         │ Accountant   │                   │
│  │             │◄────────┤              │                   │
│  │ Custody +   │         │ Exchange     │                   │
│  │ ERC20 Shares│         │ Rate & Fees  │                   │
│  └──────┬──────┘         └──────────────┘                   │
│         │                                                    │
│         │                ┌──────────────┐                   │
│         │                │   Teller     │                   │
│         │◄───────────────┤              │                   │
│         │                │ Deposit/     │                   │
│         │                │ Withdrawal   │                   │
│         │                └──────────────┘                   │
│         │                                                    │
│  ┌──────▼──────┐         ┌──────────────┐                   │
│  │  Manager    │         │ Distributor  │                   │
│  │             │         │              │                   │
│  │  Strategy   │         │ Multi-Reward │                   │
│  │  Execution  │         │ Distribution │                   │
│  └─────────────┘         └──────────────┘                   │
│                                                              │
│                          ┌──────────────┐                   │
│                          │DelayedWithdraw│                   │
│                          │              │                   │
│                          │ Time-Locked  │                   │
│                          │ Safety       │                   │
│                          └──────────────┘                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         PrimeRBAC (Access Control Hub)              │   │
│  │                      ▲                               │   │
│  │                      │ Controlled by                │   │
│  │              ┌───────┴────────┐                      │   │
│  │              │ PrimeTimelock  │                      │   │
│  │              │ (48h delay)    │                      │   │
│  │              └───────▲────────┘                      │   │
│  │                      │                               │   │
│  │                Multi-sig Wallet                      │   │
│  │              (Decentralized Control)                 │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Why This Design?**
1. **BoringVault** remains minimal (~164 LOC) = smaller attack surface
2. **Accountant** handles all math = easier to audit exchange rate logic
3. **Teller** manages deposits/withdrawals = isolates user-facing logic
4. **Manager** executes strategies = can be upgraded without touching vault
5. **Distributor** tracks rewards = no staking needed, uses share balance
6. **DelayedWithdraw** adds safety = optional time-lock layer

---

## Component Architecture

### 1. BoringVault - The Core

**Purpose:** Trustless asset custody and ERC20 share token contract

**Key Characteristics:**
- ERC20 implementation for vault shares (inherits from Solmate)
- Immutable asset address (e.g., USDC)
- Integrates `beforeUpdate` hook for reward tracking
- Minimal code = minimal attack surface

**Core Functions:**
```solidity
function enter(from, assetAmount, to, shareAmount)
  → Mint shares, receive assets
  → Called by: Teller (deposit)

function exit(to, assetAmount, from, shareAmount)
  → Burn shares, send assets
  → Called by: DelayedWithdraw (withdrawal)

function manage(target, data, value)
  → Execute arbitrary call
  → Called by: Manager (strategy execution)

function setBeforeUpdateHook(hook)
  → Set reward tracker hook
  → Called by: Admin (setup)
```

**Why Minimal?**
- No fee logic → delegated to Accountant
- No withdrawal delays → delegated to DelayedWithdraw
- No reward distribution → delegated to Distributor
- Transfer hooks called BEFORE balance changes → allows reward synchronization

**Security Features:**
- Reentrancy guard on enter/exit
- Role-based access control
- Total supply invariant checks

---

### 2. Accountant - Exchange Rate & Fees

**Purpose:** Calculate share value and accrue platform fees

**Key Formula:**
```
exchangeRate = (totalAssets - feesOwed) / totalShares

When user deposits:
  shares = depositAmount / exchangeRate

When user withdraws:
  assets = shares * exchangeRate
```

**Platform Fee Calculation:**
```solidity
// Time-based accrual (called on every update)
platformFees = (totalAssets * platformFee * timeElapsed) / (1e4 * 365 days)

// Example: 10% annual fee
// 1000 USDC vault, 1 day elapsed
// = 1000 * 0.10 * (1/365) = ~$0.274 in fees
```

**Anti-Evasion Mechanism:**
```solidity
// Uses max of current and last total shares
shareSupplyToUse = max(currentShares, totalSharesLastUpdate)

// Prevents:
// 1. User withdraws 99% of shares
// 2. Time passes
// 3. Fees calculated on 1% only (PREVENTED)
```

**State Management:**
```solidity
struct AccountantState {
    address payoutAddress;        // Fee recipient
    uint96 exchangeRate;          // Asset per share (18 decimals)
    uint128 feesOwedInBase;       // Accumulated fees
    uint128 totalSharesLastUpdate; // For anti-evasion
    uint64 lastUpdateTimestamp;
    uint16 platformFee;           // Annual fee in bps (max 20%)
}
```

---

### 3. Teller - Deposit/Withdrawal Gateway

**Purpose:** User-friendly interface with safety features

**Core Features:**
1. **Share Locking** - Prevents flash loan attacks
2. **Deposit Caps** - Prevents over-allocation
3. **Pausability** - Emergency shutdown
4. **Hook Integration** - Updates rewards on every transfer

**Deposit Flow:**
```
User calls Teller.deposit(amount, minimumShares)
  ↓
Teller.beforeUpdate(0, user, amount, caller) [Hook]
  ├─ Accountant.updateExchangeRate()
  │   ├─ Calculate platform fees
  │   └─ Update exchange rate
  └─ Distributor.updateRewardForAccount(user) [Optional]
  ↓
Calculate shares = amount / exchangeRate
  ↓
Check deposit cap: totalShares + shares ≤ depositCap
  ↓
Vault.enter(user, amount, user, shares)
  ├─ Transfer assets: user → vault
  ├─ Mint shares to user
  └─ Call beforeUpdate hook again (handled)
  ↓
Set shareUnlockTime = block.timestamp + shareLockPeriod
```

**Share Lock Mechanism:**
```solidity
// After deposit:
beforeTransferData[user].shareUnlockTime = now + 1 day

// On transfer:
if (from != 0 && beforeTransferData[from].shareUnlockTime > now) {
    revert SharesAreLocked();
}

// Prevents:
// 1. Deposit
// 2. Immediate transfer/sell
// 3. Flash loan attack
```

---

### 4. TellerWithBuffer - Yield Layer Integration

**Purpose:** Automatic management of external yield sources

**How It Works:**
```
User deposits 100 USDC
  ↓
Teller mints shares
  ↓
_afterDeposit() calls Buffer Helper
  ↓
Buffer generates management calls:
  [
    { target: USDC, data: approve(PrimeStrategist, 100) },
    { target: PrimeStrategist, data: deposit(USDC, 100) }
  ]
  ↓
Vault.bulkManage() executes atomically
  ↓
USDC moved to external yield source
```

**Withdrawal Flow:**
```
User requests withdrawal
  ↓
_beforeWithdraw() checks vault balance
  ↓
If insufficient → Buffer generates:
  [
    { target: PrimeStrategist, data: withdraw(USDC, needed) }
  ]
  ↓
Vault.bulkManage() pulls assets back
  ↓
Withdrawal completes
```

**Buffer Helper Interface:**
```solidity
interface IBufferHelper {
    function getDepositManageCall(asset, amount)
        returns (targets[], calldata[], values[])

    function getWithdrawManageCall(asset, amount)
        returns (targets[], calldata[], values[])
}
```

---

### 5. DelayedWithdraw - Time-Locked Safety

**Purpose:** Prevent emergency race conditions and flash attacks

**Withdrawal Process:**
```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Request                                         │
├─────────────────────────────────────────────────────────┤
│ User.requestWithdraw(shares, allowThirdParty)          │
│   - Shares transferred to DelayedWithdraw (locked)     │
│   - maturity = now + withdrawDelay (e.g., 3 days)      │
│   - sharesFee = shares * withdrawFee / 1e4             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Wait (3 days) OR Accelerate                    │
├─────────────────────────────────────────────────────────┤
│ Optional: accelerateWithdraw()                         │
│   - Pay expeditedWithdrawFee                           │
│   - New maturity = now + 1 day                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Complete (after maturity)                      │
├─────────────────────────────────────────────────────────┤
│ User.completeWithdraw(minAssets)                       │
│   - Vault burns shares - fees                          │
│   - Assets = (shares - fees) * exchangeRate            │
│   - Transfer assets to user                            │
└─────────────────────────────────────────────────────────┘
```

**Fee Structure:**
```solidity
// Standard withdrawal: 2% fee, 3-day delay
sharesFee = 100 shares * 0.02 = 2 shares

// Accelerated withdrawal: +5% fee, 1-day delay
accelerationFee = 100 shares * 0.05 = 5 shares
totalFee = 2 + 5 = 7 shares

// Final assets:
assetsOut = (100 - 7) * exchangeRate = 93 shares worth
```

**Outstanding Debt Tracking:**
```solidity
// Contract state:
outstandingShares = sum of all pending withdrawals

// Invariant:
outstandingShares * currentRate ≤ vault total assets

// Ensures vault can always cover pending withdrawals
```

---

### 6. Distributor - Multi-Reward Distribution

**Purpose:** Automatic reward accrual without explicit staking

**Key Innovation: BeforeUpdate Hook**
```
User transfers 100 shares → Friend

Vault.transfer(friend, 100) triggers:
  ↓
beforeUpdate(from=user, to=friend, amount=100, operator)
  ↓
Distributor.beforeUpdate():
  1. Update user's rewards (based on OLD balance)
  2. Update friend's rewards (based on OLD balance)
  ↓
Transfer executes (balance changes)
  ↓
Next transfer: uses new balances for reward calculation
```

**Reward Calculation (Synthetix-style):**
```solidity
// Global accumulator:
rewardPerToken = lastRewardPerToken +
                 (rewardRate * timeElapsed) / totalSupply

// User earnings:
earned = (balance * (rewardPerToken - userSnapshot)) / PRECISION
         + previousRewards

// When user deposits/withdraws/transfers:
userSnapshot = rewardPerToken  // Checkpoint updated
```

**Promise-Based Model:**
```
┌─────────────────────────────────────────────────────┐
│ Step 1: Admin Promises Rewards                     │
├─────────────────────────────────────────────────────┤
│ Operator.notifyRewardAmount(USDC, 1000)           │
│   - rewardRate = 1000 / 30 days                   │
│   - periodFinish = now + 30 days                  │
│   - NO tokens transferred yet                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: Admin Funds Treasury                       │
├─────────────────────────────────────────────────────┤
│ Transfer 1000 USDC to treasury address             │
│   - Distributor tracks debt                       │
│   - getRewardDebt() shows amount needed           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: Users Claim                                │
├─────────────────────────────────────────────────────┤
│ User.claimRewards([USDC, WETH])                   │
│   - If treasury set: transfer from treasury       │
│   - Else: transfer from Distributor balance       │
└─────────────────────────────────────────────────────┘
```

**Compound Feature:**
```solidity
// User can auto-reinvest rewards
User.compoundReward(account)
  ↓
Claim asset-based rewards (e.g., USDC)
  ↓
If third-party compound:
  fee = rewards * compoundFee / 1e4
  rewards -= fee
  ↓
Deposit rewards into Teller
  ↓
Mint new shares to user

// Example: 100 USDC earned, 5% fee
// → 95 USDC deposited as shares
// → 5 USDC sent to compounder
```

---

### 7. Manager - Strategy Execution

**Purpose:** Secure DeFi operations via Merkle verification

**Merkle Tree Structure:**
```
Leaf = keccak256(abi.encodePacked(
  decoder,        // Sanitizer contract
  target,         // Protocol (Aave, Uniswap, etc.)
  valueIsNonZero, // Is ETH sent?
  selector,       // Function selector
  arg1, arg2, ... // Allowed address arguments
))

Root = merkleTree.getRoot()
```

**Execution Flow:**
```
┌───────────────────────────────────────────────────────┐
│ Step 1: Admin Generates Merkle Tree                  │
├───────────────────────────────────────────────────────┤
│ Approved operations:                                 │
│   - Aave: deposit(USDC, amount, vault, 0)           │
│   - Uniswap: swap(USDC, WETH, path, vault)          │
│                                                      │
│ Create Merkle root → setManageRoot(strategist, root)│
└───────────────────────────────────────────────────────┘
                        ↓
┌───────────────────────────────────────────────────────┐
│ Step 2: Strategist Executes                          │
├───────────────────────────────────────────────────────┤
│ Generate proof for: deposit(USDC, 1000, vault, 0)   │
│                                                      │
│ manageVaultWithMerkleVerification(                  │
│   proofs = [merkleProof],                           │
│   decoders = [aaveDecoder],                         │
│   targets = [aavePool],                             │
│   data = [encoded deposit call],                    │
│   values = [0]                                      │
│ )                                                   │
└───────────────────────────────────────────────────────┘
                        ↓
┌───────────────────────────────────────────────────────┐
│ Step 3: Manager Verifies                             │
├───────────────────────────────────────────────────────┤
│ For each operation:                                  │
│   1. Decoder extracts addresses from calldata       │
│   2. Verify Merkle proof against root               │
│   3. Check total supply unchanged                   │
│                                                      │
│ If all pass:                                        │
│   Vault.bulkManage() executes atomically            │
└───────────────────────────────────────────────────────┘
                        ↓
┌───────────────────────────────────────────────────────┐
│ Result: Assets Deployed                              │
├───────────────────────────────────────────────────────┤
│ USDC moved from vault to Aave                       │
│ aUSDC received in vault                             │
│ Total supply unchanged                              │
└───────────────────────────────────────────────────────┘
```

**Security Guarantees:**
1. **Decoder Validation** - Prevents arbitrary address injection
2. **Merkle Verification** - Only pre-approved operations allowed
3. **Total Supply Invariant** - No share dilution
4. **Atomic Execution** - All-or-nothing (prevents partial exploits)

---

## Data Flow Diagrams

### Complete Deposit Flow

```
User
  │
  └──> 1. Approve USDC to Teller
  │
  └──> 2. Teller.deposit(100 USDC, 99 minShares)
        │
        ├──> Teller.beforeUpdate(0, user, 100, caller) [HOOK]
        │    │
        │    ├──> Accountant.updateExchangeRate()
        │    │    │
        │    │    ├──> Calculate fees: 0.0274 USDC (1 day * 10% APR)
        │    │    ├──> feesOwed += 0.0274
        │    │    └──> exchangeRate = (totalAssets - fees) / totalShares
        │    │              = (1000 - 0.0274) / 1000 = 0.999726
        │    │
        │    └──> Distributor.updateRewardForAccount(user) [OPTIONAL]
        │         │
        │         ├──> Update USDC rewards: earned = balance * deltaRPT
        │         ├──> Update WETH rewards: earned = balance * deltaRPT
        │         └──> userSnapshot = rewardPerToken
        │
        ├──> Calculate shares: 100 / 0.999726 = 100.0274 shares
        │
        ├──> Check cap: 1000 + 100.0274 ≤ 2000 ✓
        │
        ├──> Vault.enter(user, 100, user, 100.0274)
        │    │
        │    ├──> Transfer: user → vault (100 USDC)
        │    │
        │    ├──> beforeUpdate(0, user, 100.0274, teller) [HOOK #2]
        │    │    └──> Already handled above
        │    │
        │    └──> Mint: user receives 100.0274 shares
        │
        ├──> TellerWithBuffer._afterDeposit() [IF BUFFER SET]
        │    │
        │    └──> Buffer.getDepositManageCall(USDC, 100)
        │         │
        │         └──> Returns:
        │              targets = [USDC, PrimeStrategist]
        │              data = [approve(100), deposit(USDC, 100)]
        │              values = [0, 0]
        │              │
        │              └──> Vault.bulkManage(targets, data, values)
        │                   │
        │                   ├──> USDC.approve(PrimeStrategist, 100)
        │                   └──> PrimeStrategist.deposit(USDC, 100)
        │                        └──> 100 USDC moved to yield source
        │
        └──> Set shareUnlockTime: now + 1 day

Result:
  - User has 100.0274 shares (locked for 1 day)
  - Vault has 100 USDC deployed to PrimeStrategist
  - User starts earning USDC/WETH rewards
```

---

### Complete Withdrawal Flow (Delayed)

```
Step 1: Request Withdrawal
───────────────────────────
User
  │
  └──> DelayedWithdraw.requestWithdraw(100 shares, true)
        │
        ├──> Validate: No existing pending withdrawal ✓
        │
        ├──> Transfer: user → DelayedWithdraw (100 shares)
        │    └──> Triggers beforeUpdate hook
        │         └──> Update user's rewards before transfer
        │
        ├──> Calculate fees (locked now):
        │    sharesFee = 100 * 0.02 = 2 shares (2% fee)
        │
        ├──> Set maturity: now + 3 days
        │
        └──> outstandingShares += 100

        ⏳ Wait 3 days...

Step 2: Complete Withdrawal
────────────────────────────
User
  │
  └──> DelayedWithdraw.completeWithdraw(95 minAssets)
        │
        ├──> Validate: maturity ≤ now ✓
        │
        ├──> Accountant.updateExchangeRate()
        │    └──> Latest rate = 1.05 (5% gain)
        │
        ├──> TellerWithBuffer._beforeWithdraw(100 shares) [IF BUFFER]
        │    │
        │    ├──> Calculate needed: 100 * 1.05 = 105 USDC
        │    ├──> Check vault balance: 50 USDC (insufficient!)
        │    │
        │    └──> Buffer.getWithdrawManageCall(USDC, 55)
        │         │
        │         └──> Returns:
        │              targets = [PrimeStrategist]
        │              data = [withdraw(USDC, 55)]
        │              │
        │              └──> Vault.bulkManage()
        │                   └──> PrimeStrategist.withdraw(USDC, 55)
        │                        └──> 55 USDC returned to vault
        │
        ├──> Calculate assets:
        │    sharesToBurn = 100 - 2 = 98 shares (after fee)
        │    assetsOut = 98 * 1.05 = 102.9 USDC
        │
        ├──> Validate: 102.9 ≥ 95 minAssets ✓
        │
        ├──> Vault.exit(user, 102.9, delayedWithdraw, 100)
        │    │
        │    ├──> Burn 100 shares from DelayedWithdraw
        │    ├──> Transfer 102.9 USDC to user
        │    └──> 2.1 USDC fee (2 shares * 1.05) retained
        │
        └──> outstandingShares -= 100

Result:
  - User received 102.9 USDC (100 deposit + 5% yield - 2% fee)
  - Protocol earned 2.1 USDC in fees
  - Outstanding debt decreased by 100 shares
```

---

## Governance & Decentralization

### PrimeTimelock - Protection Against Admin Abuse

**Purpose:** Enforce mandatory delay on critical governance actions to prevent malicious admin behavior

**Key Features:**
- **48-hour minimum delay** on all privileged operations
- **Transparent queue** - all pending actions visible on-chain
- **Cancellable operations** - community can react before execution
- **Multi-sig control** - no single point of failure

**How It Works:**
```
┌─────────────────────────────────────────────────────────────┐
│         PrimeTimelock Governance Flow                        │
└─────────────────────────────────────────────────────────────┘

Step 1: Proposal (T0)
─────────────────────
Multi-sig Wallet
  │
  └──> PrimeTimelock.schedule(operation)
        │
        ├──> Operation details:
        │    - target: PrimeRBAC
        │    - data: grantRole(MALICIOUS_ACTOR, OWNER_ROLE)
        │    - delay: 48 hours (172,800 seconds)
        │
        └──> State: QUEUED (visible to all)
             └──> Event: CallScheduled(id, target, data, delay)

⏳ 48-hour Public Review Period

During this time:
  - Community monitors pending operations
  - Suspicious actions can be identified
  - Emergency response can be coordinated
  - Multi-sig can cancel if needed

Step 2: Execution (T0 + 48h)
────────────────────────────
Multi-sig Wallet
  │
  └──> PrimeTimelock.execute(operation)
        │
        ├──> Validate: now >= queuedTime + 48h ✓
        │
        ├──> Execute: PrimeRBAC.grantRole(...)
        │
        └──> State: EXECUTED
             └──> Event: CallExecuted(id, target, data)

Alternative: Cancel
───────────────────
If suspicious/malicious:
  │
  └──> PrimeTimelock.cancel(operation)
        │
        └──> State: CANCELLED (operation prevented)
```

**Protected Operations:**
```solidity
// All OWNER_ROLE actions require 48h delay:

1. Grant/Revoke Critical Roles
   - grantRole(OWNER_ROLE, newOwner)
   - revokeRole(PROTOCOL_ADMIN_ROLE, admin)

2. Change Core Parameters
   - setManageRoot(strategist, newRoot)  // Change allowed strategies
   - setPayoutAddress(newAddress)        // Change fee recipient

3. Upgrade Contracts
   - upgradeProxy(implementation)        // If using proxies

4. Emergency Actions
   - pause() / unpause()                 // System-wide pause
```

**Security Benefits:**
1. **No Instant Rug Pull** - Admin cannot drain funds immediately
2. **Community Oversight** - 48 hours to detect malicious actions
3. **Social Recovery** - Time to coordinate emergency response
4. **Transparent Governance** - All actions visible before execution

**Example Attack Prevention:**
```
❌ WITHOUT Timelock (Centralized Risk):
   T0: Admin calls grantRole(hacker, OWNER_ROLE)
   T0: Hacker immediately drains vault
   Users have 0 time to react

✅ WITH PrimeTimelock (Decentralized):
   T0: Admin schedules grantRole(hacker, OWNER_ROLE)
   T0-48h: Community sees suspicious operation
   T0+24h: Community alerts, users withdraw funds
   T0+36h: Emergency multi-sig vote to cancel
   T0+40h: Operation cancelled, attack prevented
```

---

### Multi-Sig Governance Structure

**Purpose:** Distribute control among multiple trusted parties

**Recommended Setup:**
```
┌─────────────────────────────────────────────────────────┐
│              Multi-Sig Configuration                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Signers: 5 trusted entities                           │
│    - Core Team Member #1                               │
│    - Core Team Member #2                               │
│    - Community Representative                          │
│    - Security Auditor                                  │
│    - DeFi Partnership                                  │
│                                                         │
│  Threshold: 3-of-5 signatures required                 │
│    - No single person has full control                 │
│    - Requires majority consensus                       │
│    - Prevents insider attacks                          │
│                                                         │
│  Controls: PrimeTimelock (OWNER_ROLE)                  │
│    - All critical actions require multi-sig approval   │
│    - 48-hour delay after multi-sig approval            │
│    - Double-layer protection                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Governance Hierarchy:**
```
                    Multi-Sig Wallet (3-of-5)
                            │
                            ▼
                    PrimeTimelock (48h delay)
                            │
                            ▼
                    OWNER_ROLE in PrimeRBAC
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
         Grant Roles   Change Fees  Update Roots
```

**Real-World Governance Flow:**
```
1. Proposal: "Increase platform fee from 10% to 12%"
   ├─> Discussion in governance forum
   ├─> Multi-sig members review proposal
   └─> 3 out of 5 approve

2. Schedule (via PrimeTimelock)
   ├─> Multi-sig calls: timelock.schedule(updateFee, 12%, 48h)
   ├─> Operation queued on-chain
   └─> Community notified via event

3. Review Period (48 hours)
   ├─> Users monitor queued operations
   ├─> Community discusses on Discord/Twitter
   ├─> If controversial: multi-sig can cancel
   └─> If accepted: proceed to execution

4. Execution (after 48h)
   ├─> Multi-sig calls: timelock.execute(updateFee, 12%)
   ├─> Fee updated in Accountant contract
   └─> New fee takes effect
```

**Decentralization Benefits:**
1. **No Single Point of Failure** - Requires 3 out of 5 approvals
2. **Transparent Decision Making** - All actions visible on-chain
3. **Time-Delayed Execution** - Community can react to changes
4. **Emergency Response** - Can cancel malicious operations
5. **Accountable Governance** - All signers publicly known

**Security vs Centralization Trade-offs:**
```
┌──────────────────────────────────────────────────────────┐
│                    Security Spectrum                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ❌ Fully Centralized (HIGHEST RISK)                    │
│     - Single EOA has OWNER_ROLE                         │
│     - Can drain funds instantly                         │
│     - No oversight or delays                            │
│                                                          │
│  ⚠️  Multi-Sig Only (MEDIUM RISK)                       │
│     - 3-of-5 multi-sig has OWNER_ROLE                   │
│     - Can execute instantly if compromised              │
│     - No time for community reaction                    │
│                                                          │
│  ✅ Multi-Sig + Timelock (RECOMMENDED - LOW RISK)       │
│     - 3-of-5 multi-sig controls PrimeTimelock           │
│     - All actions delayed 48 hours                      │
│     - Community can monitor and react                   │
│     - Best balance of security and flexibility          │
│                                                          │
│  🏛️ DAO Governance (MOST DECENTRALIZED)                │
│     - Token-weighted voting                             │
│     - Community controls everything                     │
│     - Slower decision making                            │
│     - Future upgrade path                               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Audit Mitigation (Bug #8 - Centralization Risk):**

From SALUS Security Audit (December 2025):
> **Issue:** Privileged roles (MANAGER_ROLE, OPERATOR_ROLE) have significant power.
> If these roles' private keys are compromised, an attacker could steal rewards.

**Prime Vaults Solution:**
```
✅ FIXED via Multi-Layer Protection:

1. OWNER_ROLE → PrimeTimelock (48h delay)
   - Cannot grant malicious roles instantly
   - Community has 48h to detect and cancel

2. PrimeTimelock → Multi-Sig Wallet (3-of-5)
   - No single person can schedule operations
   - Requires majority consensus

3. PROTOCOL_ADMIN_ROLE → Dedicated Admin Wallet
   - Limited to fee changes (capped at 20%)
   - Cannot access user funds directly
   - Can be revoked by OWNER_ROLE

4. OPERATOR_ROLE → Automated Bot + Monitoring
   - Limited to routine operations only
   - Cannot change core parameters
   - Activity monitored by community

Result: Even if OPERATOR_ROLE is compromised, attacker cannot:
  - Change OWNER_ROLE (requires multi-sig + 48h)
  - Steal user funds (no direct access)
  - Change fee recipient (requires timelock)
  - Deploy malicious strategies (requires Merkle root update)
```

---

## Security Model

### Attack Vectors Mitigated

| Attack Type | Defense Mechanism | Implementation |
|-------------|-------------------|----------------|
| **Flash Loan Attack** | Share locking | Shares locked for 1 day after deposit |
| **Sandwich Attack** | Exchange rate updates | Rate updated before each deposit |
| **Share Dilution** | Total supply check | Manager verifies supply unchanged |
| **Rug Pull** | Timelock + RBAC | Critical role changes require 48h delay |
| **Fee Theft** | Separate accounting | Fees encoded in rate, separate claim |
| **Unauthorized Strategy** | Merkle verification | All operations pre-approved via Merkle tree |
| **Reward Double-Spend** | BeforeUpdate hook | Rewards updated before balance changes |
| **Withdrawal Race** | Time-lock delays | 3-day maturity prevents panic |
| **Emergency Pause Abuse** | Multi-level pause | Pause at Teller/Accountant/Distributor levels |
| **Excessive Fees** | Hardcoded caps | Platform fee max 20%, withdrawal fee max 20% |

---

### Role-Based Security

```
┌────────────────────────────────────────────────────────────────────┐
│                    PrimeRBAC Hierarchy (Decentralized)              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  🏛️ Multi-Sig Wallet (3-of-5 signatures)                          │
│    │                                                               │
│    └──> Controls PrimeTimelock                                    │
│         │                                                          │
│         ▼                                                          │
│  ⏱️ PrimeTimelock (48-hour mandatory delay)                       │
│    │                                                               │
│    └──> Holds OWNER_ROLE in PrimeRBAC                            │
│         │                                                          │
│         ▼                                                          │
│  👑 OWNER_ROLE (Ultimate Authority - Time-Locked)                │
│    │                                                               │
│    ├──> Grant/Revoke all roles                                   │
│    ├──> Change critical parameters                               │
│    ├──> Emergency pause/unpause                                  │
│    └──> ⚠️ ALL ACTIONS DELAYED 48 HOURS                         │
│                                                                    │
│  👨‍💼 PROTOCOL_ADMIN_ROLE (Limited Admin)                         │
│    │                                                               │
│    ├──> Modify fees (CAPPED at 20% max)                          │
│    ├──> Pause/unpause contracts                                  │
│    ├──> Set Merkle roots (strategy whitelisting)                 │
│    ├──> Grant/revoke OPERATOR_ROLE                               │
│    └──> ⚠️ Cannot access user funds directly                    │
│                                                                    │
│  🤖 OPERATOR_ROLE (Routine Operations)                           │
│    │                                                               │
│    ├──> Notify rewards (promise future rewards)                  │
│    ├──> Update exchange rates (recalculate share value)          │
│    ├──> Complete user withdrawals (after maturity)               │
│    ├──> Routine operational tasks                                │
│    └──> ⚠️ No fund access, no parameter changes                 │
│                                                                    │
│  🔐 Vault-Specific Roles (Contract-to-Contract)                  │
│    │                                                               │
│    ├──> MINTER_ROLE → Teller (create shares)                    │
│    ├──> BURNER_ROLE → DelayedWithdraw (burn shares)             │
│    ├──> MANAGER_ROLE → Manager (execute strategies)              │
│    ├──> UPDATE_EXCHANGE_RATE_ROLE → Accountant                   │
│    └──> ⚠️ Assigned to contracts, not EOAs                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Decentralization Guarantees:**

1. **No Single Admin Control**
   - OWNER_ROLE held by PrimeTimelock (not EOA)
   - PrimeTimelock controlled by 3-of-5 multi-sig
   - Requires majority consensus for all critical actions

2. **Mandatory Time Delays**
   - All OWNER_ROLE actions delayed 48 hours
   - Community can monitor pending operations
   - Malicious actions can be cancelled before execution
   - Users have time to exit if needed

3. **Transparent Governance**
   - All operations queued on-chain (visible to all)
   - Events emitted for every scheduled action
   - Community can verify multi-sig signers
   - Governance dashboard shows pending operations

4. **Limited Admin Powers**
   - PROTOCOL_ADMIN cannot change OWNER_ROLE
   - Fee changes capped at 20% maximum
   - Cannot directly access user funds
   - All actions auditable on-chain

5. **Separation of Concerns**
   - OPERATOR_ROLE: routine operations only
   - PROTOCOL_ADMIN_ROLE: limited parameter changes
   - OWNER_ROLE: critical changes (time-locked)
   - Multi-sig: ultimate control (requires consensus)

**Attack Resistance:**

```
Scenario: Compromised OPERATOR_ROLE
├─> ❌ Cannot change Merkle roots (requires PROTOCOL_ADMIN)
├─> ❌ Cannot change fee recipient (requires OWNER_ROLE → 48h delay)
├─> ❌ Cannot grant themselves OWNER_ROLE (requires current OWNER → timelock)
├─> ❌ Cannot drain vault (no direct fund access)
└─> ✅ Can only execute pre-approved routine operations

Scenario: Compromised PROTOCOL_ADMIN_ROLE
├─> ⚠️ Can pause contracts (but cannot drain funds)
├─> ⚠️ Can change fees (but capped at 20% max)
├─> ❌ Cannot change OWNER_ROLE (requires current OWNER → timelock)
├─> ❌ Cannot change fee recipient instantly (requires OWNER_ROLE)
└─> ✅ OWNER_ROLE can revoke PROTOCOL_ADMIN within 48h

Scenario: Compromised 1-2 Multi-sig Signers
├─> ❌ Cannot schedule operations (requires 3-of-5 signatures)
├─> ❌ Cannot execute operations (requires 3-of-5 signatures)
└─> ✅ System remains secure with majority honest

Scenario: Compromised 3+ Multi-sig Signers (Majority)
├─> ⚠️ Can schedule malicious operations
├─> ❌ Cannot execute instantly (48-hour delay enforced)
├─> ✅ Community has 48h to detect and coordinate response
├─> ✅ Users can withdraw funds during delay period
└─> ✅ Remaining honest signers can cancel operation
```

---

### Invariants

**Critical Invariants (must always hold):**

```solidity
// 1. Asset Backing Invariant
totalVaultAssets >= (totalShares * exchangeRate) - feesOwed

// 2. Share Supply Invariant (during strategy execution)
totalSupply(before manage()) == totalSupply(after manage())

// 3. Fee Accounting Invariant
exchangeRate = (totalAssets - feesOwed) / totalShares

// 4. Delayed Withdrawal Invariant
sum(outstandingShares) * currentRate ≤ totalVaultAssets

// 5. Reward Synchronization Invariant
beforeUpdate() called before every balance change
```

---

## Integration Guide

### For Users

#### Basic Deposit & Earn
```typescript
// 1. Approve Teller
await usdc.approve(tellerAddress, amount);

// 2. Deposit
const minShares = calculateMinShares(amount, slippage);
await teller.deposit(amount, minShares);

// 3. Wait for share unlock (1 day)
// Shares automatically earn rewards

// 4. Claim rewards anytime
await distributor.claimRewards([usdcAddress, wethAddress]);

// 5. Withdraw (delayed)
await delayedWithdraw.requestWithdraw(shareAmount, false);
// Wait 3 days...
await delayedWithdraw.completeWithdraw(minAssets);
```

#### Compound Rewards
```typescript
// Option 1: Self-compound (no fee)
await distributor.compoundReward(myAddress);

// Option 2: Allow third-party compound
await distributor.setAllowThirdPartyCompound(true);
// Third party can now compound for you (pays fee)
```

---

### For Strategists

#### Deploy Strategy
```typescript
// 1. Generate Merkle tree
const leaves = [
  keccak256(aaveDecoder, aavePool, false, depositSelector, usdc),
  keccak256(uniDecoder, uniRouter, false, swapSelector, usdc, weth)
];
const tree = new MerkleTree(leaves, keccak256);
const root = tree.getRoot();

// 2. Set Merkle root
await manager.setManageRoot(strategistAddress, root);

// 3. Execute strategy
const proof = tree.getProof(leaves[0]);
await manager.manageVaultWithMerkleVerification(
  [proof],
  [aaveDecoder],
  [aavePool],
  [encodedDepositCall],
  [0]
);
```

---

### For Protocol Admins

#### Setup New Vault
```typescript
// 1. Deploy contracts
const vault = await deployBoringVault(primeRBAC, asset);
const accountant = await deployAccountant(vault, 1000); // 10% fee
const teller = await deployTeller(vault, accountant);
const distributor = await deployDistributor(primeRBAC, teller);

// 2. Configure roles
await rolesAuthority.setUserRole(teller.address, MINTER_ROLE, true);
await rolesAuthority.setUserRole(distributor.address, BURNER_ROLE, true);

// 3. Set hooks
await vault.setBeforeUpdateHook(distributor.address);
await teller.setDistributor(distributor.address);

// 4. Configure parameters
await teller.setShareLockPeriod(86400); // 1 day
await teller.setDepositCap(parseEther("1000000")); // 1M cap

// 5. Transfer ownership to PrimeTimelock (controlled by multi-sig)
await primeRBAC.grantRole(OWNER_ROLE, primeTimelock.address);
await primeRBAC.revokeRole(OWNER_ROLE, deployer.address);

// 6. Transfer timelock control to multi-sig
await primeTimelock.grantRole(PROPOSER_ROLE, multiSigWallet.address);
await primeTimelock.grantRole(EXECUTOR_ROLE, multiSigWallet.address);
await primeTimelock.revokeRole(ADMIN_ROLE, deployer.address);
```

#### Add Rewards
```typescript
// 1. Add reward token
await distributor.addReward(usdcAddress, 30 * 86400); // 30 days

// 2. Notify reward amount
await distributor.notifyRewardAmount(usdcAddress, parseEther("10000"));

// 3. Fund treasury
await usdc.transfer(treasuryAddress, parseEther("10000"));

// 4. Monitor debt
const debt = await distributor.getRewardDebt(usdcAddress);
console.log("Reward debt:", debt);
```

---

## Conclusion

Prime Vaults provides a **secure, modular, and composable** vault infrastructure that separates concerns, minimizes attack surface, and enables flexible DeFi strategy execution.

**Key Takeaways:**
1. **Minimal Core** - BoringVault is ~164 LOC for maximum security
2. **Modular Design** - Each component can be upgraded independently
3. **Time-Weighted Security** - Share locks + delayed withdrawals prevent attacks
4. **Automatic Rewards** - No staking needed, uses share balance
5. **Merkle-Verified Strategies** - Pre-approved operations only
6. **Decentralized Governance** - Multi-sig + 48h timelock prevents admin abuse
7. **No Single Point of Failure** - 3-of-5 multi-sig for all critical actions

**Security & Decentralization First:**
- **Multi-Layer Defense:** Share locks, delays, Merkle verification
- **Transparent Governance:** All operations visible on-chain before execution
- **Time-Locked Admin:** 48-hour delay on all critical changes
- **Community Protection:** Users can exit during governance delay period
- **Capped Admin Powers:** Fee changes limited to 20% maximum
- **Auditable Operations:** All actions traceable on-chain
- **Progressive Decentralization:** Path to full DAO governance

**Trust Minimization:**
```
Traditional Vault:           Prime Vaults:
┌──────────────┐            ┌──────────────────────┐
│ Single Admin │            │ 3-of-5 Multi-Sig    │
│      ↓       │            │         ↓            │
│ Instant      │            │ PrimeTimelock (48h)  │
│ Execution    │    VS      │         ↓            │
│      ↓       │            │ On-Chain Queue       │
│ High Risk    │            │         ↓            │
│              │            │ Community Review     │
│              │            │         ↓            │
│              │            │ Cancel or Execute    │
└──────────────┘            └──────────────────────┘
   ❌ Centralized               ✅ Decentralized
```

---

## Further Reading

- [BoringVault Documentation](./BORINGVAULT.md)
- [Accountant Documentation](./ACCOUNTANT.md)
- [Teller Documentation](./TELLER.md)
- [Distributor Documentation](./DISTRIBUTOR.md)
- [DelayedWithdraw Documentation](./DELAYEDWITHDRAW.md)
- [Manager Documentation](./MANAGER.md)
- [Security Model](./SECURITY.md)
- [Timelock Guide](./TIMELOCK.md)

---

**Prime Vaults Team**
© 2025 PrimeVaults
Built with ❤️ using Hardhat, Viem, and Solidity ^0.8.30
