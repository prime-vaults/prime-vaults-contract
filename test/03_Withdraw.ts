import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import { DEPOSIT_AMOUNT, PARAMETERS_ID, depositTokens, initializeTest } from "./utils.js";

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
   * Step 5 (After 3 days → T3):
   *  - Wait for withdrawal delay period (3 days).
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
      // check vault balance
      const vaultBalance = await context.mockERC20.read.balanceOf([context.vault.address]);
      assert.equal(vaultBalance, DEPOSIT_AMOUNT, "Vault should hold deposited amount");
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

    void it("Step 3: Manager deposits 100 tokens to PrimeStrategist", async function () {
      const { mockERC20, manager } = context;

      const depositLeafData = readLeaf(PARAMETERS_ID, {
        FunctionSignature: "deposit(address,uint256)",
        Description: "Deposit base asset to PrimeStrategist",
      });
      assert.ok(depositLeafData, "Deposit leaf not found");

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

      await manager.write.manageVaultWithMerkleVerification([
        [depositLeafData.proof],
        [depositLeafData.leaf.DecoderAndSanitizerAddress],
        [depositLeafData.leaf.TargetAddress as `0x${string}`],
        [depositCalldata],
        [0n],
      ]);

      const strategistAddress = depositLeafData.leaf.TargetAddress as `0x${string}`;
      const strategistBalance = await mockERC20.read.balanceOf([strategistAddress]);

      assert.equal(strategistBalance, DEPOSIT_AMOUNT, "Strategist should hold deposited amount");
    });

    void it("Step 4: Alice requests withdrawal of 100 tokens", async function () {
      const { vault, withdrawer, alice } = context;

      const userShares = await vault.read.balanceOf([alice.account.address]);

      await vault.write.approve([withdrawer.address, userShares], { account: alice.account });
      await withdrawer.write.requestWithdraw([userShares, false], { account: alice.account });

      const withdrawerShares = await vault.read.balanceOf([withdrawer.address]);
      const userSharesAfter = await vault.read.balanceOf([alice.account.address]);

      assert.equal(withdrawerShares, userShares, "Withdrawer should hold user's shares");
      assert.equal(userSharesAfter, 0n, "User should have 0 shares after request");
    });

    void it("Step 5: Wait 1 day for withdrawal delay", async function () {
      const { networkHelpers } = context;

      await networkHelpers.time.increase(3 * 24 * 60 * 60);
    });

    void it("Step 6: Alice completes withdrawal (auto pulls from PrimeStrategist)", async function () {
      const { withdrawer, mockERC20, alice, mockStrategist } = context;

      const userBalanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      const strategistBalanceBefore = await mockERC20.read.balanceOf([mockStrategist.address]);

      await withdrawer.write.completeWithdraw([alice.account.address, 0n], {
        account: alice.account,
      });

      const userBalanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const strategistBalanceAfter = await mockERC20.read.balanceOf([mockStrategist.address]);

      assert.equal(userBalanceAfter - userBalanceBefore, DEPOSIT_AMOUNT, "User should receive deposited amount");
      assert.ok(strategistBalanceAfter < strategistBalanceBefore, "Strategist balance should decrease");
    });
  });

  /**
   * Scenario: Accelerated withdrawal flow (reduce wait time from normal to 1 day).
   *
   * Step 1 (At T0):
   *  - Bob deposits 100 tokens to vault.
   *  - Bob receives 100 shares.
   *
   * Step 2:
   *  - Admin sets expedited withdraw fee to 5% (500 basis points).
   *
   * Step 3:
   *  - Bob requests normal withdrawal of 100 shares.
   *  - Maturity set to current time + normal delay (1 day in test).
   *
   * Step 4:
   *  - Bob accelerates his withdrawal to 1 day by paying 5% fee.
   *  - Acceleration fee is added to existing normal withdrawal fee.
   *  - New maturity set to current time + 1 day.
   *
   * Step 5 (After 1 day → T1):
   *  - Wait for accelerated withdrawal delay (1 day).
   *
   * Step 6:
   *  - Bob completes withdrawal.
   *  - Total fee (normal + acceleration) is deducted from shares.
   *  - Bob receives tokens minus fees.
   *
   * Expected outcome:
   *  - Bob successfully accelerates withdrawal to 1 day.
   *  - Total fee (normal + acceleration) is charged.
   *  - Fee address receives the fee shares.
   */
  void describe("Accelerated Withdrawal Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Bob deposits 100 tokens", async function () {
      const { bob } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, bob.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Shares should equal deposit amount");
    });

    void it("Step 2: Admin sets expedited withdraw fee to 5%", async function () {
      const { withdrawer, deployer } = context;

      // Set expedited fee to 5% (500 basis points)
      await withdrawer.write.changeExpeditedWithdrawFee([500], {
        account: deployer.account,
      });

      const withdrawState = await withdrawer.read.getWithdrawState();
      assert.equal(withdrawState.expeditedWithdrawFee, 500, "Expedited fee should be 5%");
    });

    void it("Step 3: Bob requests normal withdrawal", async function () {
      const { vault, withdrawer, bob } = context;

      const userShares = await vault.read.balanceOf([bob.account.address]);

      await vault.write.approve([withdrawer.address, userShares], { account: bob.account });
      await withdrawer.write.requestWithdraw([userShares, false], {
        account: bob.account,
      });

      const withdrawRequest = await withdrawer.read.withdrawRequests([bob.account.address]);
      assert.equal(withdrawRequest[2], userShares, "Request should contain user's shares");
    });

    void it("Step 4: Bob accelerates his withdrawal to 1 day", async function () {
      const { withdrawer, bob } = context;

      const withdrawRequestBefore = await withdrawer.read.getWithdrawRequest([bob.account.address]);
      const feeBeforeAcceleration = withdrawRequestBefore.sharesFee;

      await withdrawer.write.accelerateWithdraw({ account: bob.account });

      const withdrawRequest = await withdrawer.read.getWithdrawRequest([bob.account.address]);
      const feeAfterAcceleration = withdrawRequest.sharesFee;

      // Verify acceleration fee was added (5% of shares)
      const userShares = withdrawRequest.shares;
      const expectedAdditionalFee = (userShares * 500n) / 10000n;
      assert.equal(
        feeAfterAcceleration - feeBeforeAcceleration,
        expectedAdditionalFee,
        "Acceleration fee should be added",
      );
    });

    void it("Step 5: Wait 1 day for accelerated withdrawal delay", async function () {
      const { networkHelpers } = context;
      await networkHelpers.time.increase(24 * 60 * 60);
    });

    void it("Step 6: Bob completes withdrawal with total fee deducted", async function () {
      const { withdrawer, mockERC20, bob, vault } = context;

      const userBalanceBefore = await mockERC20.read.balanceOf([bob.account.address]);
      const feeAddress = await withdrawer.read.feeAddress();
      const feeAddressBalanceBefore = await vault.read.balanceOf([feeAddress]);

      const withdrawRequest = await withdrawer.read.getWithdrawRequest([bob.account.address]);
      const totalShares = withdrawRequest.shares;
      const totalFee = withdrawRequest.sharesFee;

      await withdrawer.write.completeWithdraw([bob.account.address, 0n], {
        account: bob.account,
      });

      const userBalanceAfter = await mockERC20.read.balanceOf([bob.account.address]);
      const feeAddressBalanceAfter = await vault.read.balanceOf([feeAddress]);

      // User should receive tokens for (shares - fee)
      const expectedUserTokens = totalShares - totalFee;
      const actualUserTokens = userBalanceAfter - userBalanceBefore;

      // Allow small rounding difference
      const diff =
        actualUserTokens > expectedUserTokens
          ? actualUserTokens - expectedUserTokens
          : expectedUserTokens - actualUserTokens;
      assert.ok(diff <= 1n, "User should receive approximately shares minus total fee");

      // Fee address should receive the total fee (normal + acceleration)
      assert.equal(
        feeAddressBalanceAfter - feeAddressBalanceBefore,
        totalFee,
        "Fee address should receive total fee shares",
      );
    });
  });
});
