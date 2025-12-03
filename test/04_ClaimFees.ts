import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import { DEPOSIT_AMOUNT, depositTokens, initializeTest } from "./utils.js";

void describe("04_ClaimFees", function () {
  /**
   * Scenario: Manager claims protocol fees via Merkle verification.
   * Note: With AccountantWithRateProviders, fees must be manually set via exchange rate updates.
   * This test is simplified compared to the yield streaming version.
   */
  void describe("Manager Claims Fees via Merkle", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Shares should equal deposit amount");
    });

    void it("Step 2: Generate fees by updating exchange rate", async function () {
      const { accountant, networkHelpers, deployer } = context;

      // Wait some time (1 day)
      await networkHelpers.time.increase(24 * 60 * 60);

      // Update exchange rate as strategist to accumulate platform fees
      await accountant.write.updateExchangeRate({ account: deployer.account });

      // Check that fees were accumulated
      const accountantState = await accountant.read.getAccountantState();
      console.log(`Fees owed after update: ${accountantState.feesOwedInBase}`);
      assert.ok(accountantState.feesOwedInBase > 0n, "Should have accumulated fees after 1 day");
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
      const { manager, accountant, mockERC20 } = context;

      // Unpause accountant if it was paused
      const accountantStateBefore = await accountant.read.getAccountantState();
      if (accountantStateBefore.isPaused) {
        await accountant.write.unpause();
      }

      // Check fees owed before claiming
      const feesOwedBefore = accountantStateBefore.feesOwedInBase;
      assert.ok(feesOwedBefore > 0n, "Should have accumulated platform fees");

      // Calculate expected platform fee:
      // platformFee = 150 bps = 1.5% annual
      // time passed = 1 day
      // assets = 100 tokens
      // expectedFee = 100 * 0.015 * (1/365) ≈ 0.00410958...
      const expectedFeeApprox = (DEPOSIT_AMOUNT * 150n * 86400n) / (10000n * 365n * 86400n);
      console.log(`Fees owed before claim: ${feesOwedBefore}`);
      console.log(`Expected fee (approx): ${expectedFeeApprox}`);

      // Get payout address balance before
      const payoutAddress = accountantStateBefore.payoutAddress;
      const payoutBalanceBefore = await mockERC20.read.balanceOf([payoutAddress]);

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

      // Verify fees were claimed
      const accountantStateAfter = await accountant.read.getAccountantState();
      assert.equal(accountantStateAfter.feesOwedInBase, 0n, "Fees owed should be zero after claim");

      // Verify payout address received the fees
      const payoutBalanceAfter = await mockERC20.read.balanceOf([payoutAddress]);
      const actualFeesReceived = payoutBalanceAfter - payoutBalanceBefore;

      // claimFees() calls updateExchangeRate() internally, which may add a tiny bit more fees
      // due to the time elapsed since Step 2, so we check it's at least what we saw before
      assert.ok(
        actualFeesReceived >= feesOwedBefore,
        `Payout address should receive at least ${feesOwedBefore}, got ${actualFeesReceived}`,
      );

      console.log(`Successfully claimed ${actualFeesReceived} in platform fees (expected at least ${feesOwedBefore})`);
    });
  });
});
