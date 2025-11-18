import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import { ONE_TOKEN, depositTokens, initializeTest } from "./utils.js";

void describe("04_ClaimFees", function () {
  void describe("Manager Claims Fees via Merkle", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;
    const depositAmount = 1000n * ONE_TOKEN;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: User deposits 1000 tokens", async function () {
      const result = await depositTokens(context, depositAmount);
      assert.equal(result.shares, depositAmount, "Shares should equal deposit amount");
    });

    void it("Step 2: Generate fees by updating exchange rate", async function () {
      const { accountant, networkHelpers } = context;

      await accountant.write.updateExchangeRate();
      await networkHelpers.time.increase(2 * 24 * 60 * 60); // 2 days
      await accountant.write.updateExchangeRate();
    });

    void it("Step 3: Approve Accountant to spend base asset", async function () {
      const { manager, accountant } = context;

      const approveData = readLeaf("localhost-usd", { FunctionSignature: "approve(address,uint256)" });
      assert.ok(approveData, "Approve leaf not found");

      const approveCalldata = encodeFunctionData({
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [accountant.address, 2n ** 256n - 1n],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [approveData.proof],
        [approveData.leaf.DecoderAndSanitizerAddress],
        [approveData.leaf.TargetAddress as `0x${string}`],
        [approveCalldata],
        [0n],
      ]);
    });

    void it("Step 4: Claim fees via Manager with Merkle verification", async function () {
      const { manager } = context;

      const claimFeesData = readLeaf("localhost-usd", { FunctionSignature: "claimFees()" });
      assert.ok(claimFeesData, "ClaimFees leaf not found");

      const claimFeesCalldata = encodeFunctionData({
        abi: [
          {
            name: "claimFees",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [],
            outputs: [],
          },
        ],
        functionName: "claimFees",
        args: [],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [claimFeesData.proof],
        [claimFeesData.leaf.DecoderAndSanitizerAddress],
        [claimFeesData.leaf.TargetAddress as `0x${string}`],
        [claimFeesCalldata],
        [0n],
      ]);
    });
  });
});
