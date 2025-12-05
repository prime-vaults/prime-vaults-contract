import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { DEPOSIT_AMOUNT, ONE_DAY_SECS, ONE_TOKEN, assertApproxEqual, depositTokens, initializeTest } from "./utils.js";

void describe("02_Reward", function () {
  /**
   * Scenario 1: Single user reward distribution over time.
   * Reward rate = 7 tokens total over 7 days (1 token/day).
   *
   * Step 1 (At T0):
   *  - Alice deposits 100 tokens.
   *
   * Step 2:
   *  - Admin adds reward token with 7 day duration.
   *
   * Step 3:
   *  - Admin notifies 7 tokens reward (1 token/day).
   *
   * Step 4 (After 1 day → T1):
   *  - Alice earns 1 token.
   *
   * Step 5:
   *  - Alice claims rewards.
   *  - Earned balance resets to 0.
   *
   * Step 6 (After another 1 day → T2):
   *  - Alice earns another 1 token.
   *
   * Final expected:
   *  - Alice can continuously earn and claim 1 token/day over the 7-day period.
   */
  void describe("Base Single Reward Distribution", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Shares should equal deposit amount");
    });

    void it("Step 2: Admin adds reward token with 7 day duration", async function () {
      const { mockERC20, distributor } = context;

      const rewardDuration = 7n * ONE_DAY_SECS;

      // Add reward token
      await distributor.write.addReward([mockERC20.address, rewardDuration]);

      const rewardData = await distributor.read.rewardData([mockERC20.address]);

      assert.equal(rewardData[1], rewardDuration, "Duration should be 7 days");
    });

    void it("Step 3: Admin notifies 7 tokens reward (1 token/day)", async function () {
      const { mockERC20, distributor } = context;

      const rewardAmount = 7n * ONE_TOKEN;

      // Approve distributor to pull reward tokens
      await mockERC20.write.approve([distributor.address, rewardAmount]);

      // Notify reward amount
      await distributor.write.notifyRewardAmount([mockERC20.address, rewardAmount]);

      const rewardData = await distributor.read.rewardData([mockERC20.address]);
      const rewardRate = rewardData[3]; // rewardRate
      const periodFinish = rewardData[2]; // periodFinish

      assert.ok(rewardRate > 0n, "Reward rate should be set");
      assert.ok(periodFinish > 0n, "Period finish should be set");
    });

    void it("Step 4: After 1 day, Alice earns 1 token", async function () {
      const { mockERC20, distributor, alice, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const expected = ONE_TOKEN; // 1 token per day
      assertApproxEqual(earned, expected, "Alice should earn 1 token after 1 day");
    });

    void it("Step 5: Alice claims rewards", async function () {
      const { mockERC20, distributor, alice } = context;

      const balanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      const earnedBefore = await distributor.read.earned([alice.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.claimRewards([[mockERC20.address]], { account: alice.account });

      const balanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const earnedAfter = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const received = balanceAfter - balanceBefore;
      assertApproxEqual(received, earnedBefore, "Should receive approximately all earned rewards");
      assert.equal(earnedAfter, 0n, "Earned should be 0 after claiming");
    });

    void it("Step 6: After another day, Alice earns another 1 token", async function () {
      const { mockERC20, distributor, alice, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const expected = ONE_TOKEN; // 1 token per day
      assertApproxEqual(earned, expected, "Alice should earn 1 token after another day");
    });
  });

  /**
   * Scenario 2: Two users stake at different times.
   * Total reward = 7 tokens over 7 days (1 token/day).
   * Alice and Bob each deposit 50 tokens (total 100 token balance limit).
   *
   * Step 1 (At T0):
   *  - Alice stakes 50 tokens.
   *
   * Step 2:
   *  - Admin sets up reward (7 tokens over 7 days = 1 token/day).
   *
   * Step 3 (After 1 day → T1):
   *  - Alice earns 1 token (all rewards).
   *  - Alice claims before Bob joins.
   *
   * Step 4:
   *  - Bob stakes 50 tokens.
   *  - Total pool = 100 tokens.
   *
   * Step 5 (After another 1 day → T2):
   *  - Both users have equal stake (50 each).
   *  - Daily reward 1 token is split 50/50:
   *      Alice gets 0.5 tokens
   *      Bob gets 0.5 tokens
   *
   * Step 6-8:
   *  - Both users claim their rewards.
   *  - Verify continued proportional distribution.
   *
   * Final expected:
   *  - Alice total reward = 1.5 tokens (1 + 0.5)
   *  - Bob total reward = 0.5 tokens
   */
  void describe("Two Users Staking at Different Times", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice stakes 50 tokens at T0", async function () {
      const { alice } = context;

      const depositAmount = 50n * ONE_TOKEN;
      await depositTokens(context, depositAmount, alice.account);
    });

    void it("Step 2: Admin sets up reward (7 tokens over 7 days)", async function () {
      const { mockERC20, distributor } = context;

      const rewardDuration = 7n * ONE_DAY_SECS;
      const rewardAmount = 7n * ONE_TOKEN;

      // Add reward token
      await distributor.write.addReward([mockERC20.address, rewardDuration]);

      // Approve and notify reward
      await mockERC20.write.approve([distributor.address, rewardAmount]);
      await distributor.write.notifyRewardAmount([mockERC20.address, rewardAmount]);

      const rewardData = await distributor.read.rewardData([mockERC20.address]);
      assert.ok(rewardData[3] > 0n, "Reward rate should be set");
    });

    void it("Step 3: Wait 1 day, Alice earns 1 token", async function () {
      const { mockERC20, distributor, alice, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const expected = ONE_TOKEN; // 1 token per day
      assertApproxEqual(earned, expected, "Alice should earn 1 token after 1 day");
    });

    void it("Step 3.5: Alice claims 1 token before Bob joins", async function () {
      const { mockERC20, distributor, alice } = context;

      // Claim rewards to reset Alice's earned amount
      await distributor.write.claimRewards([[mockERC20.address]], { account: alice.account });

      const earnedAfter = await distributor.read.earned([alice.account.address, mockERC20.address]);
      assert.equal(earnedAfter, 0n, "Alice earned should be 0 after claiming");
    });

    void it("Step 4: Bob stakes 50 tokens at T1 (pool becomes 100)", async function () {
      const { vault, bob } = context;

      const depositAmount = 50n * ONE_TOKEN;

      const result = await depositTokens(context, depositAmount, bob.account);
      assert.equal(result.shares, depositAmount, "Bob shares should equal deposit amount");

      // Verify total supply is now 100
      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 100n * ONE_TOKEN, "Total supply should be 100 tokens");
    });

    void it("Step 5: Wait 1 day, check proportional rewards (50/50 split)", async function () {
      const { mockERC20, distributor, alice, bob, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      // Both users share rewards proportionally: 50/50 split
      const aliceEarned = await distributor.read.earned([alice.account.address, mockERC20.address]);
      const bobEarned = await distributor.read.earned([bob.account.address, mockERC20.address]);

      const expectedEach = ONE_TOKEN / 2n; // 0.5 tokens each (half of daily reward)
      assertApproxEqual(aliceEarned, expectedEach, "Alice should earn 0.5 tokens");
      assertApproxEqual(bobEarned, expectedEach, "Bob should earn 0.5 tokens");
    });

    void it("Step 6: Alice claims rewards (should get 0.5 tokens)", async function () {
      const { mockERC20, distributor, alice } = context;

      const balanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      const earnedBefore = await distributor.read.earned([alice.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.claimRewards([[mockERC20.address]], { account: alice.account });

      const balanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const earnedAfter = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const received = balanceAfter - balanceBefore;
      assertApproxEqual(received, earnedBefore, "Alice should receive all earned rewards (0.5 tokens)");
      assert.equal(earnedAfter, 0n, "Alice earned should be 0 after claiming");
    });

    void it("Step 7: Bob claims rewards (should get 0.5 tokens)", async function () {
      const { mockERC20, distributor, bob } = context;

      const balanceBefore = await mockERC20.read.balanceOf([bob.account.address]);
      const earnedBefore = await distributor.read.earned([bob.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.claimRewards([[mockERC20.address]], { account: bob.account });

      const balanceAfter = await mockERC20.read.balanceOf([bob.account.address]);
      const earnedAfter = await distributor.read.earned([bob.account.address, mockERC20.address]);

      const received = balanceAfter - balanceBefore;
      assertApproxEqual(received, earnedBefore, "Bob should receive all earned rewards (0.5 tokens)");
      assert.equal(earnedAfter, 0n, "Bob earned should be 0 after claiming");
    });

    void it("Step 8: Wait another day, verify continued proportional distribution", async function () {
      const { mockERC20, distributor, alice, bob, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const aliceEarned = await distributor.read.earned([alice.account.address, mockERC20.address]);
      const bobEarned = await distributor.read.earned([bob.account.address, mockERC20.address]);

      const expectedEach = ONE_TOKEN / 2n; // 0.5 tokens each
      assertApproxEqual(aliceEarned, expectedEach, "Alice should earn 0.5 tokens");
      assertApproxEqual(bobEarned, expectedEach, "Bob should earn 0.5 tokens");

      // Verify total equals daily distribution
      const totalEarned = aliceEarned + bobEarned;
      const dailyReward = ONE_TOKEN; // 1 token per day
      assertApproxEqual(totalEarned, dailyReward, "Total earned should equal daily reward (1 token)");
    });

    void it("Step 9: Alice compounds rewards (auto-reinvest)", async function () {
      const { mockERC20, distributor, vault, alice } = context;

      const sharesBefore = await vault.read.balanceOf([alice.account.address]);
      const earnedBefore = await distributor.read.earned([alice.account.address, mockERC20.address]);

      // Alice compounds her own rewards (no fee)
      await distributor.write.compoundReward([alice.account.address], { account: alice.account });

      const sharesAfter = await vault.read.balanceOf([alice.account.address]);
      const earnedAfter = await distributor.read.earned([alice.account.address, mockERC20.address]);

      // Alice should receive additional shares from compounding
      const sharesGained = sharesAfter - sharesBefore;
      assert.ok(sharesGained > 0n, "Alice should receive shares from compounding");
      assertApproxEqual(sharesGained, earnedBefore, "Shares gained should equal earned rewards (0.5 tokens)");

      // Earned should be reset to 0
      assert.equal(earnedAfter, 0n, "Alice earned should be 0 after compounding");
    });

    void it("Step 10: Bob enables third-party compounding", async function () {
      const { distributor, bob } = context;

      // Bob allows third-party compounding
      await distributor.write.setAllowThirdPartyCompound([true], { account: bob.account });

      const allowed = await distributor.read.allowThirdPartyCompound([bob.account.address]);
      assert.equal(allowed, true, "Bob should allow third-party compounding");
    });

    void it("Step 11: Admin sets 10% compound fee", async function () {
      const { distributor } = context;

      // Set compound fee to 10% (1000 basis points)
      await distributor.write.setCompoundFee([1000n]);

      const fee = await distributor.read.compoundFee();
      assert.equal(fee, 1000n, "Compound fee should be 10%");
    });

    void it("Step 12: Wait 1 day, deployer compounds for Bob (with 10% fee)", async function () {
      const { mockERC20, distributor, vault, bob, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earnedBefore = await distributor.read.earned([bob.account.address, mockERC20.address]);
      const sharesBefore = await vault.read.balanceOf([bob.account.address]);
      const deployerBalanceBefore = await mockERC20.read.balanceOf(["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]);

      // Deployer compounds for Bob (third-party compound)
      await distributor.write.compoundReward([bob.account.address]);

      const sharesAfter = await vault.read.balanceOf([bob.account.address]);
      const earnedAfter = await distributor.read.earned([bob.account.address, mockERC20.address]);
      const deployerBalanceAfter = await mockERC20.read.balanceOf(["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]);

      // Calculate expected fee (10% of earned)
      const expectedFee = (earnedBefore * 1000n) / 10000n;
      const expectedCompound = earnedBefore - expectedFee;

      // Verify deployer received fee
      const deployerFee = deployerBalanceAfter - deployerBalanceBefore;
      assertApproxEqual(deployerFee, expectedFee, "Deployer should receive 10% fee");

      // Verify Bob received shares (90% of earned)
      const sharesGained = sharesAfter - sharesBefore;
      assertApproxEqual(sharesGained, expectedCompound, "Bob should receive shares from 90% of earned");

      // Earned should be reset to 0
      assert.equal(earnedAfter, 0n, "Bob earned should be 0 after compounding");
    });
  });
});
