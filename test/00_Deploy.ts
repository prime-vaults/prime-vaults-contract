import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { keccak256 } from "viem";

import { initializeTest } from "./utils.js";

void describe("00_Deploy", function () {
  void describe("Grant Role", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("1. Grant role", async function () {
      const { alice, client } = context;
      const tx = await context.primeRBAC.write.grantRole([keccak256("OPERATOR_ROLE" as any), alice.account.address]);
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      assert.equal(receipt.status, "success", "Grant role transaction should succeed");

      const hasRole = await context.primeRBAC.read.hasOperatorRole([alice.account.address]);
      assert.equal(hasRole, true, "Alice should have been granted OPERATOR_ROLE");

      const hasRoleRaw = await context.primeRBAC.read.hasRole([
        keccak256("OPERATOR_ROLE" as any),
        alice.account.address,
      ]);
      assert.equal(hasRoleRaw, true, "Alice should have been granted OPERATOR_ROLE");
    });
  });
});
