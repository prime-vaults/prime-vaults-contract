import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ONE_TOKEN, initializeTest } from "./utils.js";

void describe("01_Deposit", function () {
  void describe("Basic Deposit Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Should approve and deposit tokens successfully", async function () {
      const { mockERC20, vault, teller, deployer } = context;

      const depositAmount = 1000n * ONE_TOKEN;
      const initialBalance = await mockERC20.read.balanceOf([deployer.account.address]);

      // Approve vault to spend tokens
      await mockERC20.write.approve([vault.address, depositAmount]);

      // Deposit tokens
      await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

      const shares = await vault.read.balanceOf([deployer.account.address]);
      const balanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);

      console.table({
        "Initial Balance": initialBalance.toString(),
        "Deposit Amount": depositAmount.toString(),
        "Balance After": balanceAfter.toString(),
        "Shares Received": shares.toString(),
      });

      // Verify: User received shares equal to deposit amount (1:1 ratio on first deposit)
      assert.equal(shares, depositAmount, "Shares should equal deposit amount on first deposit");
      assert.equal(balanceAfter, initialBalance - depositAmount, "Balance should decrease by deposit amount");
    });

    void it("Step 2: Should track avgSharePrice correctly", async function () {
      const { teller, deployer, accountant } = context;

      const avgSharePrice = await teller.read.avgSharePrice([deployer.account.address]);
      const currentRate = await accountant.read.getRate();

      console.table({
        "Avg Share Price": avgSharePrice.toString(),
        "Current Rate": currentRate.toString(),
      });

      // Verify: avgSharePrice should equal current exchange rate after first deposit
      assert.equal(avgSharePrice, currentRate, "avgSharePrice should equal current rate after first deposit");
    });

    void it("Step 3: Should show zero earned profit initially", async function () {
      const { teller, deployer } = context;

      const earned = await teller.read.earned([deployer.account.address]);

      // Verify: No profit yet since no yield has been vested
      assert.equal(earned, 0n, "Earned should be 0 before any yield vesting");
    });
  });

  void describe("Edge Cases", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Should revert on zero deposit amount", async function () {
      const { teller, deployer } = context;

      try {
        await teller.write.deposit([0n, 0n, deployer.account.address]);
        assert.fail("Should have reverted on zero deposit");
      } catch (error: any) {
        assert.match(error.message, /ZeroAssets/, "Should revert with ZeroAssets error");
      }
    });

    void it("Should revert when minimumMint not met", async function () {
      const { mockERC20, vault, teller, deployer } = context;

      const depositAmount = 100n * ONE_TOKEN;
      const unrealisticMinimum = 1000n * ONE_TOKEN; // Higher than possible shares

      await mockERC20.write.approve([vault.address, depositAmount]);

      try {
        await teller.write.deposit([depositAmount, unrealisticMinimum, deployer.account.address]);
        assert.fail("Should have reverted when minimumMint not met");
      } catch (error: any) {
        assert.match(error.message, /MinimumMintNotMet/, "Should revert with MinimumMintNotMet error");
      }
    });
  });

  void describe("Multiple Deposits", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Should update avgSharePrice on second deposit", async function () {
      const { mockERC20, vault, teller, deployer, accountant } = context;

      // First deposit
      const firstDeposit = 1000n * ONE_TOKEN;
      await mockERC20.write.approve([vault.address, firstDeposit]);
      await teller.write.deposit([firstDeposit, 0n, deployer.account.address]);

      // Get initial state
      const initialShares = await vault.read.balanceOf([deployer.account.address]);
      const initialAvgPrice = await teller.read.avgSharePrice([deployer.account.address]);

      // Second deposit
      const secondDeposit = 500n * ONE_TOKEN;
      await mockERC20.write.approve([vault.address, secondDeposit]);
      await teller.write.deposit([secondDeposit, 0n, deployer.account.address]);

      const finalShares = await vault.read.balanceOf([deployer.account.address]);
      const finalAvgPrice = await teller.read.avgSharePrice([deployer.account.address]);
      const currentRate = await accountant.read.getRate();

      console.table({
        "Initial Shares": initialShares.toString(),
        "Initial Avg Price": initialAvgPrice.toString(),
        "Second Deposit": secondDeposit.toString(),
        "Final Shares": finalShares.toString(),
        "Final Avg Price": finalAvgPrice.toString(),
        "Current Rate": currentRate.toString(),
      });

      // Verify: Final shares should be sum of initial + second deposit
      assert.equal(finalShares, initialShares + secondDeposit, "Total shares should be sum of deposits");

      // Verify: avgSharePrice should be weighted average
      const expectedAvg = (initialShares * initialAvgPrice + secondDeposit * currentRate) / finalShares;
      assert.equal(finalAvgPrice, expectedAvg, "avgSharePrice should be weighted average");
    });
  });
});
