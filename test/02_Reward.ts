import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ONE_DAY_SECS, ONE_TOKEN, initializeTest } from "./utils.js";

void describe("02_Reward", function () {
  void describe("Single Reward Distribution", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: User deposits tokens", async function () {
      const { mockERC20, vault, teller, deployer } = context;

      const depositAmount = 1000n * ONE_TOKEN;

      // Approve and deposit
      await mockERC20.write.approve([vault.address, depositAmount]);
      await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

      const shares = await vault.read.balanceOf([deployer.account.address]);

      assert.equal(shares, depositAmount, "Shares should equal deposit amount");
    });

    void it("Step 2: Admin adds reward token and sets up distribution", async function () {
      const { mockERC20, distributor, deployer } = context;

      const rewardDuration = 7n * ONE_DAY_SECS; // 7 days

      // Add reward token (using same mockERC20 as reward for simplicity)
      await distributor.write.addReward([mockERC20.address, deployer.account.address, rewardDuration]);

      const rewardData = await distributor.read.rewardData([mockERC20.address]);

      assert.equal(
        rewardData[0].toLowerCase(),
        deployer.account.address.toLowerCase(),
        "Distributor should be deployer",
      );
      assert.equal(rewardData[1], rewardDuration, "Duration should be 7 days");
    });

    void it("Step 3: Distributor notifies reward amount", async function () {
      const { mockERC20, distributor } = context;

      const rewardAmount = 700n * ONE_TOKEN; // 700 tokens over 7 days = 100/day

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

    void it("Step 4: Time passes and user earns rewards", async function () {
      const { mockERC20, distributor, deployer, networkHelpers } = context;

      // Fast forward 1 day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      // Should earn ~100 tokens (700 tokens / 7 days = 100 per day)
      // Allow 1% tolerance for rounding
      const expected = 100n * ONE_TOKEN;
      const tolerance = expected / 100n;

      assert.ok(
        earned >= expected - tolerance && earned <= expected + tolerance,
        "Should earn ~100 tokens after 1 day",
      );
    });

    void it("Step 5: User claims rewards", async function () {
      const { mockERC20, distributor, deployer } = context;

      const balanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);
      const earnedBefore = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      // Claim rewards
      await distributor.write.getReward();

      const balanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);
      const earnedAfter = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      // Allow small tolerance due to time passing between earned() call and getReward()
      const received = balanceAfter - balanceBefore;
      const tolerance = earnedBefore / 100n; // 1% tolerance

      assert.ok(
        received >= earnedBefore && received <= earnedBefore + tolerance,
        "Should receive approximately all earned rewards",
      );
      assert.equal(earnedAfter, 0n, "Earned should be 0 after claiming");
    });

    void it("Step 6: User continues earning after claim", async function () {
      const { mockERC20, distributor, deployer, networkHelpers } = context;

      // Fast forward another day
      await networkHelpers.time.increase(Number(ONE_DAY_SECS));

      const earned = await distributor.read.earned([deployer.account.address, mockERC20.address]);

      // Should earn another ~100 tokens
      const expected = 100n * ONE_TOKEN;
      const tolerance = expected / 100n;

      assert.ok(
        earned >= expected - tolerance && earned <= expected + tolerance,
        "Should earn ~100 tokens after another day",
      );
    });
  });
});
