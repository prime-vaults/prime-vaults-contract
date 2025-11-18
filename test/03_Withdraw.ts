import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import { DEPOSIT_AMOUNT, depositTokens, initializeTest } from "./utils.js";

void describe("03_Withdraw", function () {
  /**
   * Scenario: Complete withdrawal flow with strategist interaction.
   *
   * Step 1 (At T0):
   *  - Alice deposits 100 tokens to vault.
   *  - Alice receives 100 shares.
   *
   * Step 2:
   *  - Manager approves PrimeStrategist via Merkle verification.
   *  - Authorizes strategist to spend vault's base asset.
   *
   * Step 3:
   *  - Manager deposits 100 tokens from vault to PrimeStrategist.
   *  - Vault balance becomes 0, strategist holds 100 tokens.
   *
   * Step 4:
   *  - Alice requests withdrawal of 100 tokens.
   *  - Alice approves withdrawer to spend shares.
   *  - Withdrawer holds Alice's shares.
   *
   * Step 5 (After 1 day → T1):
   *  - Wait for withdrawal delay period (1 day).
   *
   * Step 6:
   *  - Alice completes withdrawal.
   *  - System automatically pulls tokens from PrimeStrategist.
   *  - Alice receives 100 tokens back.
   *
   * Expected outcome:
   *  - Alice successfully withdraws deposited amount.
   *  - Tokens are pulled from strategist automatically.
   *  - Alice shares are burned.
   */
  void describe("Full Withdrawal Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Shares should equal deposit amount");
    });

    void it("Step 2: Approve PrimeStrategist via Merkle verification", async function () {
      const { manager, mockStrategist } = context;

      const approveLeafData = readLeaf("localhost-usd", {
        FunctionSignature: "approve(address,uint256)",
        Description: "Approve PrimeStrategist to spend base asset (staking token)",
      });

      assert.ok(approveLeafData, "Approve leaf not found");

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
        args: [mockStrategist.address, 2n ** 256n - 1n],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [approveLeafData.proof],
        [approveLeafData.leaf.DecoderAndSanitizerAddress],
        [approveLeafData.leaf.TargetAddress as `0x${string}`],
        [approveCalldata],
        [0n],
      ]);
    });

    void it("Step 3: Manager deposits 1 token to PrimeStrategist", async function () {
      const { mockERC20, vault, mockStrategist } = context;

      const depositCalldata = encodeFunctionData({
        abi: [
          {
            name: "deposit",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "asset", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [],
          },
        ],
        functionName: "deposit",
        args: [mockERC20.address, DEPOSIT_AMOUNT],
      });

      await vault.write.manage([mockStrategist.address, depositCalldata, 0n]);

      const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);
      const vaultBalance = await mockERC20.read.balanceOf([vault.address]);

      assert.equal(strategistBalance, DEPOSIT_AMOUNT, "Strategist should hold deposited amount");
      assert.equal(vaultBalance, 0n, "Vault should have 0 balance after depositing to strategist");
    });

    void it("Step 4: Alice requests withdrawal of 100 tokens", async function () {
      const { vault, withdrawer, alice, mockERC20 } = context;

      const userShares = await vault.read.balanceOf([alice.account.address]);

      await vault.write.approve([withdrawer.address, userShares], { account: alice.account });
      await withdrawer.write.requestWithdraw([mockERC20.address, userShares, false], { account: alice.account });

      const withdrawerShares = await vault.read.balanceOf([withdrawer.address]);
      const userSharesAfter = await vault.read.balanceOf([alice.account.address]);

      assert.equal(withdrawerShares, userShares, "Withdrawer should hold user's shares");
      assert.equal(userSharesAfter, 0n, "User should have 0 shares after request");
    });

    void it("Step 5: Wait 1 day for withdrawal delay", async function () {
      const { networkHelpers } = context;

      await networkHelpers.time.increase(24 * 60 * 60);
    });

    void it("Step 6: Alice completes withdrawal (auto pulls from PrimeStrategist)", async function () {
      const { withdrawer, mockERC20, alice, mockStrategist } = context;

      const userBalanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      const strategistBalanceBefore = await mockERC20.read.balanceOf([mockStrategist.address]);

      await withdrawer.write.completeWithdraw([mockERC20.address, alice.account.address], {
        account: alice.account,
      });

      const userBalanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const strategistBalanceAfter = await mockERC20.read.balanceOf([mockStrategist.address]);

      assert.equal(userBalanceAfter - userBalanceBefore, DEPOSIT_AMOUNT, "User should receive deposited amount");
      assert.ok(strategistBalanceAfter < strategistBalanceBefore, "Strategist balance should decrease");
    });
  });
});
