import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ONE_TOKEN, depositTokens, initializeTest } from "./utils.js";

void describe("01_Deposit", function () {
  void describe("Basic Deposit Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Should approve and deposit 1000 tokens successfully", async function () {
      const depositAmount = 1000n * ONE_TOKEN;

      const result = await depositTokens(context, depositAmount);

      // Verify: User received shares equal to deposit amount (1:1 ratio on first deposit)
      assert.equal(result.shares, depositAmount, "Shares should equal deposit amount on first deposit");
      assert.equal(
        result.balanceAfter,
        result.initialBalance - depositAmount,
        "Balance should decrease by deposit amount",
      );
    });
  });
});
