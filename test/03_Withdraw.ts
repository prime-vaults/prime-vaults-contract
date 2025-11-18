import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import { ONE_TOKEN, depositTokens, initializeTest } from "./utils.js";

void describe("03_Withdraw", function () {
  /**
   * Scenario: Complete withdrawal flow with strategist interaction.
   *
   * Step 1 (At T0):
   *  - User deposits 1 token to vault.
   *  - User receives 1 share.
   *
   * Step 2:
   *  - Manager approves PrimeStrategist via Merkle verification.
   *  - Authorizes strategist to spend vault's base asset.
   *
   * Step 3:
   *  - Manager deposits 1 token from vault to PrimeStrategist.
   *  - Vault balance becomes 0, strategist holds 1 token.
   *
   * Step 4:
   *  - User requests withdrawal of 1 token.
   *  - User approves withdrawer to spend shares.
   *  - Withdrawer holds user's shares.
   *
   * Step 5 (After 1 day → T1):
   *  - Wait for withdrawal delay period (1 day).
   *
   * Step 6:
   *  - User completes withdrawal.
   *  - System automatically pulls tokens from PrimeStrategist.
   *  - User receives 1 token back.
   *
   * Expected outcome:
   *  - User successfully withdraws deposited amount.
   *  - Tokens are pulled from strategist automatically.
   *  - User shares are burned.
   */
  void describe("Full Withdrawal Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;
    const depositAmount = 1n * ONE_TOKEN;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: User deposits 1 token", async function () {
      const result = await depositTokens(context, depositAmount);
      assert.equal(result.shares, depositAmount, "Shares should equal deposit amount");
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
        args: [mockERC20.address, depositAmount],
      });

      await vault.write.manage([mockStrategist.address, depositCalldata, 0n]);

      const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);
      const vaultBalance = await mockERC20.read.balanceOf([vault.address]);

      assert.equal(strategistBalance, depositAmount, "Strategist should hold deposited amount");
      assert.equal(vaultBalance, 0n, "Vault should have 0 balance after depositing to strategist");
    });

    void it("Step 4: User requests withdrawal of 1 token", async function () {
      const { vault, withdrawer, deployer, mockERC20 } = context;

      const userShares = await vault.read.balanceOf([deployer.account.address]);

      await vault.write.approve([withdrawer.address, userShares]);
      await withdrawer.write.requestWithdraw([mockERC20.address, userShares, false]);

      const withdrawerShares = await vault.read.balanceOf([withdrawer.address]);
      const userSharesAfter = await vault.read.balanceOf([deployer.account.address]);

      assert.equal(withdrawerShares, userShares, "Withdrawer should hold user's shares");
      assert.equal(userSharesAfter, 0n, "User should have 0 shares after request");
    });

    void it("Step 5: Wait 1 day for withdrawal delay", async function () {
      const { networkHelpers } = context;
      await networkHelpers.time.increase(1 * 24 * 60 * 60);
    });

    void it("Step 6: Complete withdrawal (auto pulls from PrimeStrategist)", async function () {
      const { withdrawer, mockERC20, deployer, mockStrategist, vault } = context;

      const userBalanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);
      const strategistBalanceBefore = await mockERC20.read.balanceOf([mockStrategist.address]);

      await withdrawer.write.completeWithdraw([mockERC20.address, deployer.account.address]);

      const userBalanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);
      const strategistBalanceAfter = await mockERC20.read.balanceOf([mockStrategist.address]);

      assert.equal(userBalanceAfter - userBalanceBefore, depositAmount, "User should receive deposited amount");
      assert.ok(strategistBalanceAfter < strategistBalanceBefore, "Strategist balance should decrease");
    });
  });
});
