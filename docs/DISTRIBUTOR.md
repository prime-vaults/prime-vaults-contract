# Distributor - Multi-Reward Distribution System

## Purpose

**Distributor** is the **automated reward distribution system** for vault share holders. Instead of separate staking, users automatically receive rewards based
on the amount of vault shares they hold.

## Role in Ecosystem

Distributor is the **reward management layer**:

- **Promise-based rewards**: Admin notifies rewards first, deposits later
- **Automatic accrual**: Rewards automatically accumulate over time
- **Multi-token support**: Supports multiple reward tokens simultaneously
- **No staking required**: Users only need to hold vault shares
- **Third-party compounding**: Allows third parties to compound rewards (with fee)
- **Hook integration**: Automatically updates rewards when shares are transferred

## Promise-Based Architecture

### Traditional Staking vs Promise-Based

**Traditional**:

```
1. Admin deposits 1000 USDC into contract
2. Admin notifies reward (1000 USDC over 7 days)
3. Contract distributes from existing balance
```

**Promise-Based (Distributor)**:

```
1. Admin notifies reward (1000 USDC over 7 days) ← NO deposit yet
2. Contract tracks "reward debt" = 1000 USDC
3. Admin deposits later when users claim
4. Contract distributes from balance
```

**Benefits**:

- **Capital efficiency**: No need to deposit everything upfront
- **Flexible timing**: Deposit when needed, not urgent
- **Debt tracking**: `getRewardDebt()` shows how much needs to be deposited

## Core Functions

### 1. Notify Reward (Admin)

```solidity
function notifyRewardAmount(address _rewardsToken, uint256 reward, uint256 duration)
    external requiresAuth
```

**Purpose**: Admin "promises" to distribute `reward` tokens over `duration` seconds

**Flow**:

1. Check reward token exists
2. Calculate `rewardRate = reward / duration`
3. Update `rewardPerTokenStored` and `lastUpdateTime`
4. Set `periodFinish = block.timestamp + duration`
5. Emit `RewardAdded`

**Example**:

```javascript
// Admin notify: 1000 USDC over 7 days
reward = 1000e6
duration = 7 days = 604800 seconds
rewardRate = 1000e6 / 604800 ≈ 1653 wei/second

// Users will receive total 1000 USDC over 7 days
```

### 2. Claim Rewards (User)

```solidity
function claimRewards(address[] memory _rewardTokens)
    public requiresAuth returns (uint256[] memory)
```

**Flow**:

1. Loop through each reward token
2. Update reward accounting for user (trigger `updateReward` modifier)
3. Calculate `earned = (balance * rewardPerToken) / 1e18 + previousRewards`
4. Reset `rewards[user][token] = 0`
5. Transfer tokens to user
6. Emit `RewardPaid`

**Example**:

```javascript
// User has 100 shares, rewardPerToken = 50e18
// (meaning each share receives 50 reward tokens)

earned = (100e18 * 50e18) / 1e18 = 5000e18 tokens
// User receives 5000 reward tokens
```

### 3. Compound Reward (Auto-reinvest)

```solidity
function compoundReward(address _account) external updateReward(_account) requiresAuth
```

**Purpose**: Claim rewards and automatically deposit back into vault to increase shares

**Flow**:

1. Check `isPaused`
2. Calculate earned rewards for vault's base asset
3. If third-party caller:
   - Check `allowThirdPartyCompound[_account] = true`
   - Calculate fee = `rewardAmount * compoundFee / 1e4`
   - Transfer fee to caller (incentive for keepers)
4. Approve vault to spend rewards
5. Call `teller.deposit(amountToCompound, 0, _account)`
6. User nhận shares mới
7. Emit `CompoundReward`

**Example**:

```javascript
// User has 100 USDC rewards, compoundFee = 500 (5%)
// Third-party bot calls compoundReward(user)

fee = 100 * 500 / 10000 = 5 USDC → bot receives
amountToCompound = 100 - 5 = 95 USDC
shares = teller.deposit(95, 0, user)
// User receives additional shares from 95 USDC
```

### 4. Allow Third-Party Compound

```solidity
function setAllowThirdPartyCompound(bool _allowed) external requiresAuth
```

**Use Case**: User allows keeper bots to automatically compound rewards

```javascript
// User enable
distributor.setAllowThirdPartyCompound(true);

// Keeper bot can call
distributor.compoundReward(user);
// Bot receives 5% fee, user receives new shares
```

## Reward Accounting System

### Core Formula

```solidity
rewardPerToken = rewardPerTokenStored +
    ((lastTimeRewardApplicable - lastUpdateTime) * rewardRate * 1e18) / totalSupply

earned = (balance * (rewardPerToken - userRewardPerTokenPaid)) / 1e18 + previousRewards
```

### Example Calculation

```javascript
// Setup
totalSupply = 1000 shares
rewardRate = 100 tokens/second
duration = 1000 seconds

// After 100 seconds
timeElapsed = 100 seconds
newRewards = 100 * 100 = 10000 tokens
rewardPerToken = 0 + (10000 * 1e18) / 1000 = 10e18

// User A: 100 shares (10% of total)
earnedA = (100 * 10e18) / 1e18 = 1000 tokens (10% of 10000)

// User B: 300 shares (30% of total)
earnedB = (300 * 10e18) / 1e18 = 3000 tokens (30% of 10000)
```

## Reward Debt System

### What is Reward Debt?

**Reward Debt** = Total reward tokens the contract "owes" users based on promises

### Calculate Debt

```solidity
function getRewardDebt(address _rewardsToken) external view returns (uint256 debt)
```

**Formula**:

```solidity
applicableTime = min(currentTime, periodFinish)
timeElapsed = applicableTime - lastUpdateTime
rewardsSinceLastUpdate = timeElapsed * rewardRate

currentRewardPerToken = rewardPerTokenStored + (rewardsSinceLastUpdate * 1e18) / totalSupply
debt = (currentRewardPerToken * totalSupply) / 1e18
```

**Example**:

```javascript
// Admin notified 1000 USDC over 10 days
// After 6 days:

rewardRate = 1000e6 / (10 * 86400) = 1157 wei/sec
timeElapsed = 6 days = 518400 seconds
rewardsSinceLastUpdate = 518400 * 1157 = 599.5e6

debt = 599.5 USDC
// Admin needs to deposit at least 599.5 USDC to cover claims
```

### Admin Deposit Flow

```javascript
// Step 1: Check debt
const debt = await distributor.getRewardDebt(rewardToken);
const balance = await rewardToken.balanceOf(distributor);
const needed = debt - balance;

// Step 2: Deposit if needed
if (needed > 0) {
  await rewardToken.transfer(distributor, needed);
}

// Step 3: Users can safely claim
await distributor.claimRewards([rewardToken]);
```

## Hook Integration (IBeforeUpdateHook)

**Purpose**: Automatically update rewards when user transfers shares

### Hook Flow

```
User transfers shares → vault.transfer(from, to, amount)
                      → vault.beforeTransfer(from, to, amount)
                      → distributor.beforeTransfer(from, to)
                      → updateRewardForAccount(from)
                      → updateRewardForAccount(to)
```

**Why needed?**:

- Rewards calculated based on share balance
- Transfer changes balance
- Must update rewards BEFORE balance changes
- Ensures accuracy

**Example**:

```javascript
// Alice: 100 shares, rewardPerToken = 10
// Alice earned = 100 * 10 / 1e18 = 0.001 (not yet claimed)

// Alice transfers 50 shares to Bob
// Hook triggers:
//   1. Update Alice rewards = 0.001 (lock before transfer)
//   2. Update Bob rewards = 0 (Bob has no shares yet)
//   3. Transfer 50 shares
// Result:
//   - Alice: 50 shares, 0.001 rewards locked
//   - Bob: 50 shares, 0 rewards (start earning from now)
```

## Third-Party Compounding Mechanism

### Actors

- **User**: Vault share holder
- **Keeper**: Third-party bot/service
- **Protocol**: Distributor contract

### Flow

```
┌─────────────────────────────────────────────────┐
│ Step 1: User Enable Third-Party                 │
│  - user.setAllowThirdPartyCompound(true)        │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ Step 2: Keeper Monitors Rewards                 │
│  - earned = distributor.earned(user, USDC)      │
│  - if earned > threshold: compound              │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ Step 3: Keeper Compounds                        │
│  - keeper.compoundReward(user)                  │
│  - fee = earned * 5% = 5 USDC → keeper          │
│  - deposit = 95 USDC → user shares              │
└─────────────────────────────────────────────────┘
```

### Incentive Model

```javascript
// Config: compoundFee = 500 (5%)

// User has 100 USDC rewards
// Keeper calls compound:

keeperFee = 100 * 0.05 = 5 USDC
userDeposit = 100 - 5 = 95 USDC

// Keeper receives 5 USDC immediately
// User receives shares from 95 USDC (auto-compounding)
```

## Roles & Permissions

| Role               | Permission     | Functions                                                    |
| ------------------ | -------------- | ------------------------------------------------------------ |
| **Public**         | Claim & view   | `claimRewards()`, `setAllowThirdPartyCompound()`, `earned()` |
| **Keeper/Public**  | Compound       | `compoundReward()` (if allowed)                              |
| **PROTOCOL_ADMIN** | Setup & manage | `addReward()`, `setCompoundFee()`, `pause()`                 |
| **OPERATOR**       | Notify rewards | `notifyRewardAmount()`                                       |
| **BoringVault**    | Hook trigger   | `beforeTransfer()` (automatic)                               |

## Contract Interactions

### 1. **BoringVault** (Share Balance)

```
Distributor reads → vault.balanceOf(user)
                  → vault.totalSupply()
                  → Calculate rewards proportionally
```

### 2. **Teller** (Compounding)

```
User compound → distributor.compoundReward(user)
              → teller.deposit(rewards, 0, user)
              → User receives new shares
```

### 3. **BoringVault Hook** (Auto-update)

```
Transfer trigger → vault.beforeTransfer(from, to)
                 → distributor.beforeTransfer(from, to)
                 → updateRewardForAccount(from)
                 → updateRewardForAccount(to)
```

## State Variables

### RewardData Struct

```solidity
struct RewardData {
  uint256 rewardsDuration; // Duration of reward period
  uint256 periodFinish; // Timestamp when period ends
  uint256 rewardRate; // Tokens per second
  uint256 lastUpdateTime; // Last reward update timestamp
  uint256 rewardPerTokenStored; // Accumulated reward per token
}
```

### Mappings

```solidity
mapping(address => RewardData) public rewardData;              // Token → data
mapping(address => mapping(address => uint256)) public rewards;              // User → Token → earned
mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;  // User → Token → checkpoint
mapping(address => bool) public allowThirdPartyCompound;       // User → allow
```

## Reward Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ Admin Operations                                │
│  1. addReward(USDC)                             │
│  2. notifyRewardAmount(USDC, 1000, 7 days)      │
│     → rewardRate = 1000 / 604800 ≈ 0.00165/s    │
│     → periodFinish = now + 7 days               │
└─────────────────────────────────────────────────┘
                      │
                      ▼ Time passes (rewards accrue)
┌─────────────────────────────────────────────────┐
│ User Operations                                 │
│  3. User checks: earned(user, USDC) = 50        │
│  4. User claims: claimRewards([USDC])           │
│     → Transfer 50 USDC to user                  │
│     OR                                          │
│  5. User compounds: compoundReward(user)        │
│     → Deposit 50 USDC → get shares              │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ Admin Debt Management                           │
│  6. Check debt: getRewardDebt(USDC) = 600       │
│  7. Check balance: USDC.balanceOf(distributor)=0│
│  8. Deposit: USDC.transfer(distributor, 600)    │
│     → Now users can claim safely                │
└─────────────────────────────────────────────────┘
```

## Technical Specifications

### Precision

- **Reward per token**: 18 decimals (1e18)
- **Formula**: `(balance * rewardPerToken) / 1e18`
- **Rounding**: Down (users may lose dust)

### Time Mechanics

```solidity
lastTimeRewardApplicable = min(currentTime, periodFinish)
```

- Rewards accrue until `periodFinish`
- After `periodFinish`, `rewardPerToken` stays constant
- No new rewards after period ends

### Safety Checks

- **Pause mechanism**: Admin can pause claims/compounds
- **Debt tracking**: `getRewardDebt()` warns admin needs to deposit
- **Balance check**: Claims fail if contract doesn't have enough balance
- **Authorization**: `requiresAuth` for all user functions

## Multi-Reward Example

```javascript
// Admin setup 2 reward tokens
distributor.addReward(USDC);
distributor.addReward(WETH);

// Notify rewards
distributor.notifyRewardAmount(USDC, 1000e6, 7 days);
distributor.notifyRewardAmount(WETH, 0.5e18, 7 days);

// User earns both
earnedUSDC = distributor.earned(user, USDC);  // 50 USDC
earnedWETH = distributor.earned(user, WETH);  // 0.025 WETH

// User claims both
distributor.claimRewards([USDC, WETH]);
// User receives 50 USDC + 0.025 WETH
```

## Important Notes

1. **Promise-based**: Admin must deposit before users claim (check `getRewardDebt()`)
2. **No staking**: Rewards are automatic, no separate staking required
3. **Hook dependency**: Requires BoringVault hook integration
4. **Compound asset limitation**: Can only compound vault's base asset
5. **Third-party incentive**: Compound fee creates incentive for automation
6. **Reward finalization**: After `periodFinish`, cannot claim more (except existing earned)
7. **Precision loss**: Rounding down may lose dust amounts
8. **Multi-reward complexity**: Each token has independent accounting
