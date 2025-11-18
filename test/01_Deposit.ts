import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ONE_TOKEN, depositTokens, initializeTest } from "./utils.js";

void describe("01_Deposit", function () {
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
  void describe("Basic Deposit Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: User deposits 1000 tokens", async function () {
      const depositAmount = 1000n * ONE_TOKEN;

      const result = await depositTokens(context, depositAmount);

      assert.equal(result.shares, depositAmount, "Shares should equal deposit amount on first deposit");
      assert.equal(
        result.balanceAfter,
        result.initialBalance - depositAmount,
        "Balance should decrease by deposit amount",
      );
    });
  });
});
