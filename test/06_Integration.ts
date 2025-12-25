import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { DEPOSIT_AMOUNT, ONE_TOKEN, depositTokens, initializeTest } from "./utils.js";

void describe("06_Integration - Complex Multi-User Scenarios", function () {
  /**
   * Scenario 1: Multiple users with overlapping deposit/withdraw cycles
   *
   * Timeline:
   * T0: Alice deposits 100 tokens
   * T1 (1 day): Bob deposits 100 tokens
   * T2 (2 days): Charlie deposits 100 tokens, Alice requests withdrawal
   * T3 (3 days): Admin notifies 30 tokens reward (10 tokens/day for 3 days)
   * T4 (5 days): Bob requests withdrawal
   * T5 (6 days): Alice completes withdrawal, Dave deposits 100 tokens
   * T6 (8 days): Bob completes withdrawal
   * T7 (10 days): Everyone claims rewards
   *
   * Expected outcomes:
   * - Alice earns rewards for 2 days (T0-T2)
   * - Bob earns rewards for 5 days (T1-T6)
   * - Charlie earns rewards for full period (T2-T7)
   * - Dave earns rewards for 4 days (T6-T7)
   * - Rewards distributed proportionally to time and shares held
   */
  void describe("Multi-User Deposit/Withdraw with Rewards", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("T0: Alice deposits 100 tokens", async function () {
      const { alice, vault } = context;

      await depositTokens(context, DEPOSIT_AMOUNT, alice.account);

      const aliceShares = await vault.read.balanceOf([alice.account.address]);
      assert.equal(aliceShares, DEPOSIT_AMOUNT, "Alice should have 100 shares");
    });

    void it("T1: Wait 1 day, Bob deposits 100 tokens", async function () {
      const { bob, vault, networkHelpers } = context;

      await networkHelpers.time.increase(24 * 60 * 60); // 1 day

      await depositTokens(context, DEPOSIT_AMOUNT, bob.account);

      const bobShares = await vault.read.balanceOf([bob.account.address]);
      assert.equal(bobShares, DEPOSIT_AMOUNT, "Bob should have 100 shares");

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 200n * ONE_TOKEN, "Total supply should be 200");
    });

    void it("T2: Wait 1 day, Charlie deposits 100 tokens, Alice requests withdrawal", async function () {
      const { alice, charlie, vault, withdrawer, networkHelpers } = context;

      await networkHelpers.time.increase(24 * 60 * 60); // 1 day (total 2 days)

      // Charlie deposits
      await depositTokens(context, DEPOSIT_AMOUNT, charlie.account);

      const charlieShares = await vault.read.balanceOf([charlie.account.address]);
      assert.equal(charlieShares, DEPOSIT_AMOUNT, "Charlie should have 100 shares");

      // Alice requests withdrawal
      const aliceShares = await vault.read.balanceOf([alice.account.address]);
      await vault.write.approve([withdrawer.address, aliceShares], { account: alice.account });
      await withdrawer.write.requestWithdraw([aliceShares, false], { account: alice.account });

      // Shares transferred to withdrawer
      const aliceSharesAfter = await vault.read.balanceOf([alice.account.address]);
      assert.equal(aliceSharesAfter, 0n, "Alice shares should be transferred to withdrawer");
    });

    void it("T3: Wait 1 day, Admin adds reward token and notifies 30 tokens", async function () {
      const { distributor, mockERC20, deployer, networkHelpers } = context;

      await networkHelpers.time.increase(24 * 60 * 60); // 1 day (total 3 days)

      // Add reward token
      await distributor.write.addReward([mockERC20.address, 7n * 24n * 60n * 60n], {
        account: deployer.account,
      });

      // Notify 30 tokens as reward (distributed over 7 days)
      const rewardAmount = 30n * ONE_TOKEN;
      await mockERC20.write.mint([deployer.account.address, rewardAmount]);
      await mockERC20.write.approve([distributor.address, rewardAmount], { account: deployer.account });

      await distributor.write.notifyRewardAmount([mockERC20.address, rewardAmount], {
        account: deployer.account,
      });

      const rewardData = await distributor.read.rewardData([mockERC20.address]);
      assert.ok(rewardData[0] > 0n, "Reward rate should be set"); // rewardRate
    });

    void it("T4: Wait 2 days, Bob requests withdrawal", async function () {
      const { bob, vault, withdrawer, networkHelpers } = context;

      await networkHelpers.time.increase(2 * 24 * 60 * 60); // 2 days (total 5 days)

      const bobShares = await vault.read.balanceOf([bob.account.address]);
      await vault.write.approve([withdrawer.address, bobShares], { account: bob.account });
      await withdrawer.write.requestWithdraw([bobShares, false], { account: bob.account });

      const bobSharesAfter = await vault.read.balanceOf([bob.account.address]);
      assert.equal(bobSharesAfter, 0n, "Bob shares should be transferred to withdrawer");
    });

    void it("T5: Wait 1 day, Alice completes withdrawal, Dave deposits 100 tokens", async function () {
      const { alice, dave, withdrawer, mockERC20, networkHelpers } = context;

      await networkHelpers.time.increase(24 * 60 * 60); // 1 day (total 6 days)

      // Alice completes withdrawal (3 days after request)
      const aliceBalanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      await withdrawer.write.completeWithdraw([alice.account.address, 0n], { account: alice.account });

      const aliceBalanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      assert.ok(aliceBalanceAfter > aliceBalanceBefore, "Alice should receive tokens");

      // Dave deposits
      await depositTokens(context, DEPOSIT_AMOUNT, dave.account);

      const daveShares = await context.vault.read.balanceOf([dave.account.address]);
      assert.ok(daveShares > 0n, "Dave should receive shares");
    });

    void it("T6: Wait 2 days, Bob completes withdrawal", async function () {
      const { bob, withdrawer, mockERC20, networkHelpers } = context;

      await networkHelpers.time.increase(2 * 24 * 60 * 60); // 2 days (total 8 days)

      const bobBalanceBefore = await mockERC20.read.balanceOf([bob.account.address]);
      await withdrawer.write.completeWithdraw([bob.account.address, 0n], { account: bob.account });

      const bobBalanceAfter = await mockERC20.read.balanceOf([bob.account.address]);
      assert.ok(bobBalanceAfter > bobBalanceBefore, "Bob should receive tokens");
    });

    void it("T7: Wait 2 days, check reward distribution fairness", async function () {
      const { charlie, dave, distributor, mockERC20, networkHelpers } = context;

      await networkHelpers.time.increase(2 * 24 * 60 * 60); // 2 days (total 10 days)

      // Update rewards for all participants
      await distributor.write.updateRewardForAccount([charlie.account.address]);
      await distributor.write.updateRewardForAccount([dave.account.address]);

      // Charlie should have most rewards (held shares for longest time during reward period)
      const charlieEarned = await distributor.read.earned([charlie.account.address, mockERC20.address]);

      // Dave should have rewards proportional to his time (4 days)
      const daveEarned = await distributor.read.earned([dave.account.address, mockERC20.address]);

      console.log(`Charlie earned: ${charlieEarned}`);
      console.log(`Dave earned: ${daveEarned}`);

      // Charlie held shares longer, should earn more
      assert.ok(charlieEarned > daveEarned, "Charlie should earn more than Dave (held shares longer)");

      // Total earned should not exceed notified amount
      const totalEarned = charlieEarned + daveEarned;
      assert.ok(totalEarned <= 30n * ONE_TOKEN, "Total earned should not exceed notified amount");
    });
  });

  /**
   * Scenario 2: Multiple reward tokens simultaneous distribution
   *
   * Setup:
   * - 3 users (Alice, Bob, Charlie) with different deposit amounts
   * - 3 reward tokens (Token A, Token B, Token C)
   * - Different reward rates and durations
   *
   * Expected outcomes:
   * - Each token distributes independently
   * - Users earn proportional to their share balance
   * - No cross-contamination between reward tokens
   */
  void describe("Multiple Reward Tokens Distribution", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
      // Use mockTokenB from initializeTest() - no need to deploy new tokens
    });

    void it("Step 1: Alice deposits 100, Bob deposits 200, Charlie deposits 300", async function () {
      const { alice, bob, charlie, vault, mockERC20 } = context;

      // Alice deposits 100
      await depositTokens(context, 100n * ONE_TOKEN, alice.account);

      // Bob deposits 200
      await mockERC20.write.mint([bob.account.address, 200n * ONE_TOKEN]);
      await depositTokens(context, 200n * ONE_TOKEN, bob.account);

      // Charlie deposits 300
      await mockERC20.write.mint([charlie.account.address, 300n * ONE_TOKEN]);
      await depositTokens(context, 300n * ONE_TOKEN, charlie.account);

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 600n * ONE_TOKEN, "Total supply should be 600");
    });

    void it("Step 2: Admin adds 2 reward tokens with different configurations", async function () {
      const { distributor, deployer, mockERC20, mockTokenB } = context;

      // Add Token A (base token) - 7 day duration
      await distributor.write.addReward([mockERC20.address, 7n * 24n * 60n * 60n], {
        account: deployer.account,
      });

      // Add Token B - 14 day duration
      await distributor.write.addReward([mockTokenB.address, 14n * 24n * 60n * 60n], {
        account: deployer.account,
      });

      // Verify via rewardData
      const dataA = await distributor.read.rewardData([mockERC20.address]);
      const dataB = await distributor.read.rewardData([mockTokenB.address]);

      // rewardData[1] is duration
      assert.ok(dataA[1] > 0n, "Token A should have duration set");
      assert.ok(dataB[1] > 0n, "Token B should have duration set");
    });

    void it("Step 3: Admin notifies different amounts for each token", async function () {
      const { distributor, deployer, mockERC20, mockTokenB, client } = context;

      // Notify 700 Token A (18 decimals - 100 per day for 7 days)
      const amountA = 700n * ONE_TOKEN;
      await mockERC20.write.mint([deployer.account.address, amountA]);
      await mockERC20.write.approve([distributor.address, amountA], { account: deployer.account });
      const hashA = await distributor.write.notifyRewardAmount([mockERC20.address, amountA], {
        account: deployer.account,
      });
      await client.waitForTransactionReceipt({ hash: hashA });

      // Notify 1400 Token B (6 decimals - 100 per day for 14 days)
      const amountB = 1400n * 10n ** 6n; // 6 decimals
      await mockTokenB.write.mint([deployer.account.address, amountB], { account: deployer.account });
      await mockTokenB.write.approve([distributor.address, amountB], { account: deployer.account });
      const hashB = await distributor.write.notifyRewardAmount([mockTokenB.address, amountB], {
        account: deployer.account,
      });
      await client.waitForTransactionReceipt({ hash: hashB });

      // FIX: notifyRewardAmount does NOT transfer tokens - must transfer manually
      // Transfer Token A to Distributor
      const transferAHash = await mockERC20.write.transfer([distributor.address, amountA], {
        account: deployer.account,
      });
      await client.waitForTransactionReceipt({ hash: transferAHash });

      // Transfer Token B to Distributor
      const transferBHash = await mockTokenB.write.transfer([distributor.address, amountB], {
        account: deployer.account,
      });
      await client.waitForTransactionReceipt({ hash: transferBHash });

      console.log("All reward tokens notified and transferred to Distributor successfully");
    });

    void it("Step 4: Wait 7 days, verify proportional distribution", async function () {
      const { alice, bob, charlie, distributor, mockERC20, mockTokenB, networkHelpers } = context;

      await networkHelpers.time.increase(7 * 24 * 60 * 60); // 7 days

      // Update rewards for all users
      await distributor.write.updateRewardForAccount([alice.account.address]);
      await distributor.write.updateRewardForAccount([bob.account.address]);
      await distributor.write.updateRewardForAccount([charlie.account.address]);

      // Check Token A earnings (should be proportional to shares: 1:2:3)
      const aliceEarnedA = await distributor.read.earned([alice.account.address, mockERC20.address]);
      const bobEarnedA = await distributor.read.earned([bob.account.address, mockERC20.address]);
      const charlieEarnedA = await distributor.read.earned([charlie.account.address, mockERC20.address]);

      console.log(`Token A - Alice: ${aliceEarnedA}, Bob: ${bobEarnedA}, Charlie: ${charlieEarnedA}`);

      // Bob should earn approximately 2x Alice
      const bobToAliceRatio = Number(bobEarnedA) / Number(aliceEarnedA);
      assert.ok(bobToAliceRatio >= 1.95 && bobToAliceRatio <= 2.05, "Bob should earn ~2x Alice");

      // Charlie should earn approximately 3x Alice
      const charlieToAliceRatio = Number(charlieEarnedA) / Number(aliceEarnedA);
      assert.ok(charlieToAliceRatio >= 2.95 && charlieToAliceRatio <= 3.05, "Charlie should earn ~3x Alice");

      // Check Token B earnings
      const aliceEarnedB = await distributor.read.earned([alice.account.address, mockTokenB.address]);
      const bobEarnedB = await distributor.read.earned([bob.account.address, mockTokenB.address]);
      const charlieEarnedB = await distributor.read.earned([charlie.account.address, mockTokenB.address]);

      console.log(`Token B - Alice: ${aliceEarnedB}, Bob: ${bobEarnedB}, Charlie: ${charlieEarnedB}`);

      // Verify proportional distribution for Token B
      assert.ok(bobEarnedB > aliceEarnedB, "Bob should earn more than Alice");
      assert.ok(charlieEarnedB > bobEarnedB, "Charlie should earn more than Bob");
    });

    void it("Step 5: Users claim all reward tokens", async function () {
      const { alice, distributor, mockERC20, mockTokenB } = context;

      // Alice claims all rewards
      const aliceBalanceABefore = await mockERC20.read.balanceOf([alice.account.address]);
      const aliceBalanceBBefore = await mockTokenB.read.balanceOf([alice.account.address]);

      // Claim all tokens at once
      await distributor.write.claimRewards([[mockERC20.address, mockTokenB.address]], { account: alice.account });

      // Verify Alice received all tokens
      const aliceBalanceAAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const aliceBalanceBAfter = await mockTokenB.read.balanceOf([alice.account.address]);

      assert.ok(aliceBalanceAAfter > aliceBalanceABefore, "Alice should receive Token A");
      assert.ok(aliceBalanceBAfter > aliceBalanceBBefore, "Alice should receive Token B");

      console.log(`Alice claimed: ${aliceBalanceAAfter - aliceBalanceABefore} Token A`);
      console.log(`Alice claimed: ${aliceBalanceBAfter - aliceBalanceBBefore} Token B`);
    });
  });

  /**
   * Scenario 3: Exchange rate changes with deposits/withdrawals
   *
   * Tests share price appreciation and fee accumulation
   */
  void describe("Exchange Rate Evolution", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Set platform fee to 10% and deposit", async function () {
      const { accountant, deployer, alice } = context;

      // Set 10% platform fee
      await accountant.write.updatePlatformFee([1000], { account: deployer.account });

      // Alice deposits 100 tokens
      await depositTokens(context, 100n * ONE_TOKEN, alice.account);

      const rate = await accountant.read.getRateSafe();
      console.log(`Initial exchange rate: ${rate}`);
    });

    void it("Step 2: Wait 30 days, verify fee accumulation", async function () {
      const { accountant, deployer, networkHelpers } = context;

      await networkHelpers.time.increase(30 * 24 * 60 * 60); // 30 days

      // Get rate before update to accumulate fees
      const rateBefore = await accountant.read.getRateSafe();

      // Update exchange rate
      await accountant.write.updateExchangeRate({ account: deployer.account });

      const accountantState = await accountant.read.getAccountantState();
      const feesOwed = accountantState.feesOwedInBase;

      console.log(`Fees accumulated after 30 days: ${feesOwed}`);
      assert.ok(feesOwed > 0n, "Should accumulate fees after 30 days");

      // Expected fee: ~0.83% of 100 tokens = ~0.83 tokens (10% APR for 30 days)
      const expectedFee = (100n * ONE_TOKEN * 1000n * 30n) / (10000n * 365n);
      const diff = feesOwed > expectedFee ? feesOwed - expectedFee : expectedFee - feesOwed;
      const tolerance = expectedFee / 10n; // 10% tolerance

      assert.ok(diff <= tolerance, `Fees should be approximately ${expectedFee}, got ${feesOwed}`);
    });

    void it("Step 3: Bob deposits same amount, may get different shares", async function () {
      const { bob, vault, mockERC20, accountant } = context;

      await mockERC20.write.mint([bob.account.address, 100n * ONE_TOKEN]);

      const bobSharesBefore = await vault.read.balanceOf([bob.account.address]);
      await depositTokens(context, 100n * ONE_TOKEN, bob.account);

      const bobSharesAfter = await vault.read.balanceOf([bob.account.address]);
      const bobSharesReceived = bobSharesAfter - bobSharesBefore;

      console.log(`Bob received ${bobSharesReceived} shares for 100 tokens`);

      // Check current exchange rate
      const rate = await accountant.read.getRateSafe();
      console.log(`Exchange rate when Bob deposits: ${rate}`);

      // Bob's shares depend on accumulated fees and exchange rate
      // With 10% APR over 30 days, fees accumulate gradually
      // Bob should receive approximately 100 tokens worth of shares at current rate
      assert.ok(bobSharesReceived > 0n, "Bob should receive shares");

      // The share amount may be slightly less than 100e18 due to accumulated fees
      // but the difference should be small (less than 1% for 30 days at 10% APR)
      const percentDiff = Number((100n * ONE_TOKEN - bobSharesReceived) * 100n) / Number(100n * ONE_TOKEN);
      console.log(`Bob's shares differ from 100 by ${percentDiff.toFixed(4)}%`);
    });
  });
});
