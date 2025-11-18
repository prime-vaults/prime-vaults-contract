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
  });
});
