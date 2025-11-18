import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ONE_DAY_SECS, ONE_TOKEN, assertApproxEqual, depositTokens, initializeTest } from "./utils.js";

void describe("02_Reward", function () {
  /**
   * Scenario 1: Single user reward distribution over time.
   * Reward rate = 100 tokens/day (700 tokens over 7 days).
   *
   * Step 1 (At T0):
   *  - User deposits 1000 tokens.
   *
   * Step 2:
   *  - Admin adds reward token with 7 day duration.
   *
   * Step 3:
   *  - Admin notifies 700 tokens reward (100/day).
   *
   * Step 4 (After 1 day → T1):
   *  - User earns ~100 tokens.
   *
   * Step 5:
   *  - User claims rewards.
   *  - Earned balance resets to 0.
   *
   * Step 6 (After another 1 day → T2):
   *  - User earns another ~100 tokens.
   *
   * Final expected:
   *  - User can continuously earn and claim rewards over the 7-day period.
   */
  void describe("Base Single Reward Distribution", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: User deposits 1000 tokens", async function () {
      const depositAmount = 1000n * ONE_TOKEN;
      const result = await depositTokens(context, depositAmount);
      assert.equal(result.shares, depositAmount, "Shares should equal deposit amount");
    });

    void it("Step 2: Admin adds reward token with 7 day duration", async function () {
      const { mockERC20, distributor, deployer } = context;

      const rewardDuration = 7n * ONE_DAY_SECS;

      // Add reward token
      await distributor.write.addReward([mockERC20.address, deployer.account.address, rewardDuration]);

      const rewardData = await distributor.read.rewardData([mockERC20.address]);

      assert.equal(
        rewardData[0].toLowerCase(),
        deployer.account.address.toLowerCase(),
        "Distributor should be deployer",
      );
      assert.equal(rewardData[1], rewardDuration, "Duration should be 7 days");
    });

    void it("Step 3: Distributor notifies 700 tokens reward (100/day)", async function () {
      const { mockERC20, distributor } = context;

      const rewardAmount = 700n * ONE_TOKEN;

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

    void it("Step 4: After 1 day, user earns ~100 tokens", async function () {
      const { mockERC20, distributor, deployer, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      const expected = 100n * ONE_TOKEN;
      assertApproxEqual(earned, expected, "Should earn ~100 tokens after 1 day");
    });

    void it("Step 5: User claims rewards", async function () {
      const { mockERC20, distributor, deployer } = context;

      const balanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);
      const earnedBefore = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.claimRewards([[mockERC20.address]]);

      const balanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);
      const earnedAfter = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      const received = balanceAfter - balanceBefore;
      assertApproxEqual(received, earnedBefore, "Should receive approximately all earned rewards");
      assert.equal(earnedAfter, 0n, "Earned should be 0 after claiming");
    });

    void it("Step 6: After another day, user earns another ~100 tokens", async function () {
      const { mockERC20, distributor, deployer, networkHelpers } = context;

      // Fast forward another day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      const expected = 100n * ONE_TOKEN;
      assertApproxEqual(earned, expected, "Should earn ~100 tokens after another day");
    });
  });

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
  void describe("Two Users Staking at Different Times", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: User1 stakes 100 tokens at T0", async function () {
      const depositAmount = 100n * ONE_TOKEN;
      await depositTokens(context, depositAmount, context.deployer.account);
    });

    void it("Step 2: Setup reward (700 tokens over 7 days = 100/day)", async function () {
      const { mockERC20, distributor, deployer } = context;

      const rewardDuration = 7n * ONE_DAY_SECS;
      const rewardAmount = 700n * ONE_TOKEN;

      // Add reward token
      await distributor.write.addReward([mockERC20.address, deployer.account.address, rewardDuration]);

      // Approve and notify reward
      await mockERC20.write.approve([distributor.address, rewardAmount]);
      await distributor.write.notifyRewardAmount([mockERC20.address, rewardAmount]);

      const rewardData = await distributor.read.rewardData([mockERC20.address]);
      assert.ok(rewardData[3] > 0n, "Reward rate should be set");
    });

    void it("Step 3: Wait 1 day, User1 earns 100 tokens", async function () {
      const { mockERC20, distributor, deployer, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      const expected = 100n * ONE_TOKEN;
      assertApproxEqual(earned, expected, "User1 should earn 100 tokens after 1 day");
    });

    void it("Step 3.5: User1 claims 100 tokens before User2 joins", async function () {
      const { mockERC20, distributor, deployer } = context;

      // Claim rewards to reset User1's earned amount
      await distributor.write.claimRewards([[mockERC20.address]]);

      const earnedAfter = await distributor.read.earned([deployer.account.address, mockERC20.address]);
      assert.equal(earnedAfter, 0n, "User1 earned should be 0 after claiming");
    });

    void it("Step 4: User2 stakes 100 tokens at T1 (pool becomes 200)", async function () {
      const { vault, alice } = context;

      const depositAmount = 100n * ONE_TOKEN;

      const result = await depositTokens(context, depositAmount, alice.account);
      assert.equal(result.shares, depositAmount, "User2 shares should equal deposit amount");

      // Verify total supply is now 200
      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 200n * ONE_TOKEN, "Total supply should be 200 tokens");
    });

    void it("Step 5: Wait 1 day, check proportional rewards (50/50 split)", async function () {
      const { mockERC20, distributor, deployer, alice, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      // Both users share rewards proportionally: 50/50 split
      const user1Earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);
      const user2Earned = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const expectedUser1 = 50n * ONE_TOKEN;
      assertApproxEqual(user1Earned, expectedUser1, "User1 should earn ~50 tokens");

      const expectedUser2 = 50n * ONE_TOKEN;
      assertApproxEqual(user2Earned, expectedUser2, "User2 should earn ~50 tokens");
    });

    void it("Step 6: User1 claims rewards (should get ~50 tokens)", async function () {
      const { mockERC20, distributor, deployer } = context;

      const balanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);
      const earnedBefore = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.claimRewards([[mockERC20.address]]);

      const balanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);
      const earnedAfter = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      const received = balanceAfter - balanceBefore;
      assertApproxEqual(received, earnedBefore, "User1 should receive all earned rewards (~50 tokens)");
      assert.equal(earnedAfter, 0n, "User1 earned should be 0 after claiming");
    });

    void it("Step 7: User2 claims rewards (should get ~50 tokens)", async function () {
      const { mockERC20, distributor, alice } = context;

      const balanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      const earnedBefore = await distributor.read.earned([alice.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.claimRewards([[mockERC20.address]], { account: alice.account });

      const balanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const earnedAfter = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const received = balanceAfter - balanceBefore;
      assertApproxEqual(received, earnedBefore, "User2 should receive all earned rewards (~50 tokens)");
      assert.equal(earnedAfter, 0n, "User2 earned should be 0 after claiming");
    });

    void it("Step 8: Wait another day, verify continued proportional distribution", async function () {
      const { mockERC20, distributor, deployer, alice, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const user1Earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);
      const user2Earned = await distributor.read.earned([alice.account.address, mockERC20.address]);

      const expected = 50n * ONE_TOKEN;
      assertApproxEqual(user1Earned, expected, "User1 should earn ~50 tokens");
      assertApproxEqual(user2Earned, expected, "User2 should earn ~50 tokens");

      // Verify total equals daily distribution
      const totalEarned = user1Earned + user2Earned;
      const dailyReward = 100n * ONE_TOKEN;
      assertApproxEqual(totalEarned, dailyReward, "Total earned should equal daily reward (100 tokens)");
    });
  });
});
