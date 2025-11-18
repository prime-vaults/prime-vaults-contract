# Test Conventions

This document describes the testing conventions used in this project. Follow these guidelines to maintain consistency
and readability across all test files.

## File Organization

### Test File Naming

- Use numbered prefixes: `01_Feature.ts`, `02_Feature.ts`
- Name format: `{number}_{FeatureName}.ts`
- Examples: `01_Deposit.ts`, `02_Reward.ts`, `03_Withdraw.ts`

### Test File Structure

```typescript
import "./utils.js";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

void describe("{number}_{FeatureName}", function () {
  /**
   * Scenario documentation here (see Scenario Convention below)
   */
  void describe("{Test Suite Name}", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step {N}: {Action description}", async function () {
      // Test implementation
    });
  });
});
```

## Scenario Convention

Every test suite MUST include a scenario block that explains:

1. **Scenario title**: Brief description of what's being tested
2. **Configuration**: Key parameters (reward rates, amounts, durations)
3. **Timeline**: Step-by-step breakdown with time markers (T0, T1, T2, etc.)
4. **Expected outcome**: Final state or verification points

### Scenario Template

```typescript
/**
 * Scenario {N}: {Brief title describing the scenario}.
 * {Key configuration parameters, e.g., "Reward rate = 100 tokens/day"}
 *
 * Step 1 (At T0):
 *  - {Action 1}
 *  - {Action 2}
 *
 * Step 2 (After {duration} → T1):
 *  - {State change or action}
 *  - {Expected intermediate result}
 *
 * Step 3 (After {duration} → T2):
 *  - {Action or state}
 *  - {Calculation or split logic}
 *
 * Final expected:
 *  - {Expected outcome 1}
 *  - {Expected outcome 2}
 */
```

### Scenario Examples

#### Example 1: Simple Single-User Flow

```typescript
/**
 * Scenario: Basic deposit flow for a user.
 *
 * Step 1 (At T0):
 *  - User approves vault to spend 1000 tokens.
 *  - User deposits 1000 tokens.
 *  - Vault mints 1000 shares (1:1 ratio on first deposit).
 *
 * Expected outcome:
 *  - User receives shares equal to deposit amount.
 *  - User's token balance decreases by deposit amount.
 *  - Vault holds the deposited tokens.
 */
```

#### Example 2: Multi-User with Calculations

```typescript
/**
 * Scenario 2: Two users stake at different times.
 * Reward rate = 100 tokens/day.
 *
 * Step 1 (At T0):
 *  - User1 stakes 100.
 *
 * Step 2 (After 1 day → T1):
 *  - User1 reward = 100.
 *  - User2 stakes 100.
 *  - Total pool = 200.
 *
 * Step 3 (After another 1 day → T2):
 *  - Both users have equal stake (100 each).
 *  - Daily reward 100 is split 50/50:
 *      User1 gets +50
 *      User2 gets +50
 *
 * Final expected:
 *  - User1 total reward = 150
 *  - User2 total reward = 50
 */
```

#### Example 3: Multi-Step Process

```typescript
/**
 * Scenario: Complete withdrawal flow with strategist interaction.
 *
 * Step 1 (At T0):
 *  - User deposits 1 token to vault.
 *  - User receives 1 share.
 *
 * Step 2:
 *  - Manager approves PrimeStrategist via Merkle verification.
 *  - Authorizes strategist to spend vault's base asset.
 *
 * Step 3:
 *  - Manager deposits 1 token from vault to PrimeStrategist.
 *  - Vault balance becomes 0, strategist holds 1 token.
 *
 * Step 4:
 *  - User requests withdrawal of 1 token.
 *  - User approves withdrawer to spend shares.
 *  - Withdrawer holds user's shares.
 *
 * Step 5 (After 1 day → T1):
 *  - Wait for withdrawal delay period (1 day).
 *
 * Step 6:
 *  - User completes withdrawal.
 *  - System automatically pulls tokens from PrimeStrategist.
 *  - User receives 1 token back.
 *
 * Expected outcome:
 *  - User successfully withdraws deposited amount.
 *  - Tokens are pulled from strategist automatically.
 *  - User shares are burned.
 */
```

## Test Step Conventions

### Step Naming

- Always prefix with `Step {N}:` for clear ordering
- Use descriptive action-based names
- Examples:
  - ✅ `"Step 1: User deposits 1000 tokens"`
  - ✅ `"Step 2: Admin adds reward token with 7 day duration"`
  - ❌ `"Test deposit"` (too vague)
  - ❌ `"Deposit test case"` (not action-based)

### Step Numbering

- Use sequential numbers: Step 1, Step 2, Step 3, etc.
- Use decimals for intermediate steps: Step 3.5, Step 4.5
- Example: `"Step 3.5: User1 claims 100 tokens before User2 joins"`

### Step Content Structure

```typescript
void it("Step {N}: {Action description}", async function () {
  const {
    /* destructure context */
  } = context;

  // 1. Setup/preparation (if needed)
  const amount = 1000n * ONE_TOKEN;

  // 2. Execute action
  const result = await someAction(amount);

  // 3. Verify outcome with assertions
  assert.equal(result.value, expectedValue, "Clear assertion message");
  assert.ok(condition, "Explanation of what should be true");
});
```

## Assertion Conventions

### Assertion Messages

- Always provide clear, descriptive messages
- Message should state what SHOULD happen, not what failed
- Format: `"{Subject} should {expected behavior}"`

Examples:

```typescript
// ✅ Good assertion messages
assert.equal(shares, depositAmount, "Shares should equal deposit amount");
assert.ok(rewardRate > 0n, "Reward rate should be set");
assertApproxEqual(earned, expected, "User should earn ~100 tokens after 1 day");

// ❌ Poor assertion messages
assert.equal(shares, depositAmount); // Missing message
assert.equal(shares, depositAmount, "Failed"); // Too vague
assert.equal(shares, depositAmount, "shares != depositAmount"); // Describes failure, not expectation
```

### Approximate Equality

For calculations with potential rounding errors:

```typescript
assertApproxEqual(actual, expected, "Description of what should match");
```

Use when:

- Dealing with reward calculations over time
- Exchange rate conversions
- Any division or percentage calculations

## Time Management in Tests

### Time Constants

Use predefined constants from `utils.js`:

```typescript
const ONE_DAY_SECS = 24n * 60n * 60n;
```

### Time Progression

```typescript
// Fast forward time
await networkHelpers.time.increase(Number(ONE_DAY_SECS));

// Always document time changes in comments
void it("Step 4 (After 1 day → T1): User earns rewards", async function () {
  // Fast forward 1 day
  await networkHelpers.time.increase(Number(ONE_DAY_SECS));

  // Verify state after time progression
});
```

### Time Markers in Scenarios

- Use T0, T1, T2, etc. to mark timeline points
- Always specify duration: "After 1 day → T1", "After 2 days → T2"
- Keep timeline consistent throughout scenario and tests

## Multi-User Testing

### User Identification

```typescript
// User1 (deployer)
const { deployer } = context;

// User2 (alice)
const [, user2] = await connection.viem.getWalletClients();

// User3 (bob)
const [, , user3] = await connection.viem.getWalletClients();
```

### User Actions

```typescript
// Specify which user is acting
await depositTokens(context, amount, deployer.account);
await depositTokens(context, amount, user2.account);

// Always verify per-user state
const user1Balance = await token.read.balanceOf([deployer.account.address]);
const user2Balance = await token.read.balanceOf([user2.account.address]);
```

### User-Specific Comments

```typescript
// User1 is the only staker, gets all rewards
const user1Earned = await distributor.read.earned([deployer.account.address, token.address]);

// User2 joined later, gets proportional share
const user2Earned = await distributor.read.earned([user2.account.address, token.address]);
```

## Context and Setup

### Shared Context

```typescript
let context: Awaited<ReturnType<typeof initializeTest>>;

before(async function () {
  context = await initializeTest();
});
```

### Destructuring Context

Destructure only what you need in each test:

```typescript
void it("Step 1: User deposits tokens", async function () {
  const { vault, mockERC20, deployer } = context;
  // Use only vault, mockERC20, deployer in this test
});
```

### Constants

Define test-specific constants at the suite level:

```typescript
void describe("Full Withdrawal Flow", function () {
  let context: Awaited<ReturnType<typeof initializeTest>>;
  const depositAmount = 1n * ONE_TOKEN; // Shared across all tests in suite

  // ...tests
});
```

## Comments in Tests

### Inline Comments

```typescript
// Explain WHY, not WHAT
const rewardAmount = 700n * ONE_TOKEN; // 700 tokens over 7 days = 100/day

// Explain calculations
// User1: 100/200 = 50% → earns 50 tokens this day
// User2: 100/200 = 50% → earns 50 tokens this day

// Document state changes
// Claim rewards to reset User1's earned amount
await distributor.write.claimRewards([[mockERC20.address]]);
```

### Section Comments

```typescript
void it("Step 5: Verify proportional split", async function () {
  // Fast forward another day
  await networkHelpers.time.increase(Number(ONE_DAY_SECS));

  // Now both users share rewards proportionally
  const user1Earned = await distributor.read.earned([user1, token]);
  const user2Earned = await distributor.read.earned([user2, token]);

  // Verify 50/50 split
  assertApproxEqual(user1Earned, expectedUser1);
  assertApproxEqual(user2Earned, expectedUser2);
});
```

## Best Practices

### DO:

- ✅ Write clear scenario documentation for every test suite
- ✅ Use sequential step numbering with descriptive names
- ✅ Provide descriptive assertion messages
- ✅ Document time progressions and calculations
- ✅ Use `assertApproxEqual` for reward/exchange rate calculations
- ✅ Destructure only needed context variables
- ✅ Define test-specific constants at suite level
- ✅ Use meaningful variable names (`depositAmount`, `rewardRate`)
- ✅ Group related assertions with comments

### DON'T:

- ❌ Skip scenario documentation
- ❌ Use vague test names like "test deposit"
- ❌ Omit assertion messages
- ❌ Use magic numbers without explanation
- ❌ Mix setup and verification without comments
- ❌ Forget to document time progressions
- ❌ Use exact equality for calculations with potential rounding
- ❌ Hardcode addresses or values that should be constants

## Example: Complete Test File

```typescript
import { ONE_DAY_SECS, ONE_TOKEN, assertApproxEqual, depositTokens, initializeTest } from "./utils.js";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

void describe("05_FeatureName", function () {
  /**
   * Scenario: Description of what this test suite validates.
   * Key parameters: rate = X, duration = Y
   *
   * Step 1 (At T0):
   *  - Action 1
   *  - Action 2
   *
   * Step 2 (After duration → T1):
   *  - State change
   *  - Expected result
   *
   * Final expected:
   *  - Outcome 1
   *  - Outcome 2
   */
  void describe("Test Suite Name", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;
    const testAmount = 1000n * ONE_TOKEN;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Descriptive action name", async function () {
      const { vault, mockERC20, deployer } = context;

      // Execute action
      const result = await depositTokens(context, testAmount);

      // Verify outcome
      assert.equal(result.shares, testAmount, "Shares should equal deposit amount");
    });

    void it("Step 2: Another descriptive action", async function () {
      const { mockERC20, distributor, networkHelpers } = context;

      // Fast forward time
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      // Verify state after time progression
      const earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);
      assertApproxEqual(earned, expectedAmount, "User should earn expected amount");
    });
  });
});
```

## For AI/LLM Context

When generating or modifying tests:

1. **Always start with scenario documentation** using the template above
2. **Use time markers (T0, T1, T2)** consistently in both scenario and test steps
3. **Show calculations in scenario** when dealing with proportional splits or rates
4. **Include "Final expected"** section to summarize outcomes
5. **Number steps sequentially** starting from 1
6. **Use decimals (3.5, 4.5)** for intermediate cleanup/verification steps
7. **Match test step numbers to scenario steps** for easy cross-reference
8. **Always provide assertion messages** that describe expected behavior
9. **Use `assertApproxEqual`** for any calculations involving division or time-based accrual
10. **Document time progressions** in both comments and test names

This ensures tests are self-documenting, easy to understand, and maintainable.
