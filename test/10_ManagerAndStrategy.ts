import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import { DEPOSIT_AMOUNT, ONE_TOKEN, PARAMETERS_ID, assertApproxEqual, depositTokens, initializeTest } from "./utils.js";

void describe("10_ManagerAndStrategy", function () {
  /**
   * Scenario 1: Manager deposits to strategy via Merkle verification
   * Tests proper flow using manageVaultWithMerkleVerification
   */
  void describe("Manager Deposits to Strategy via Merkle", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Alice should receive 100 shares");
    });

    void it("Step 2: Manager approves PrimeStrategist via Merkle verification", async function () {
      const { manager, mockStrategist } = context;

      const approveLeafData = await readLeaf(PARAMETERS_ID, {
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

    void it("Step 3: Manager deposits 50 tokens to PrimeStrategist", async function () {
      const { mockERC20, manager, vault } = context;

      const depositAmount = 50n * ONE_TOKEN;
      const vaultBalanceBefore = await mockERC20.read.balanceOf([vault.address]);

      const depositLeafData = await readLeaf(PARAMETERS_ID, {
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
        args: [mockERC20.address, depositAmount],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [depositLeafData.proof],
        [depositLeafData.leaf.DecoderAndSanitizerAddress],
        [depositLeafData.leaf.TargetAddress as `0x${string}`],
        [depositCalldata],
        [0n],
      ]);

      const vaultBalanceAfter = await mockERC20.read.balanceOf([vault.address]);
      const strategistAddress = depositLeafData.leaf.TargetAddress as `0x${string}`;
      const strategistBalance = await mockERC20.read.balanceOf([strategistAddress]);

      assert.equal(vaultBalanceAfter, vaultBalanceBefore - depositAmount, "Vault balance should decrease");
      assert.ok(strategistBalance >= depositAmount, "Strategist should receive tokens");
    });

    void it("Step 4: Verify strategy holds tokens", async function () {
      const { mockERC20, vault, mockStrategist } = context;

      const vaultBalance = await mockERC20.read.balanceOf([vault.address]);
      const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);

      // Vault has 50 tokens, strategist has 50 tokens
      assert.equal(vaultBalance, 50n * ONE_TOKEN, "Vault should have 50 tokens");
      assert.ok(strategistBalance >= 50n * ONE_TOKEN, "Strategist should have at least 50 tokens");
    });

    void it("Step 5: Manager withdraws 30 tokens from PrimeStrategist via Merkle", async function () {
      const { mockERC20, manager, vault } = context;

      const withdrawAmount = 30n * ONE_TOKEN;
      const vaultBalanceBefore = await mockERC20.read.balanceOf([vault.address]);

      const withdrawLeafData = await readLeaf(PARAMETERS_ID, {
        FunctionSignature: "withdraw(address,uint256)",
        Description: "Withdraw from PrimeStrategist back to vault",
      });
      assert.ok(withdrawLeafData, "Withdraw leaf not found");

      const withdrawCalldata = encodeFunctionData({
        abi: [
          {
            name: "withdraw",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "asset", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [],
          },
        ],
        functionName: "withdraw",
        args: [mockERC20.address, withdrawAmount],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [withdrawLeafData.proof],
        [withdrawLeafData.leaf.DecoderAndSanitizerAddress],
        [withdrawLeafData.leaf.TargetAddress as `0x${string}`],
        [withdrawCalldata],
        [0n],
      ]);

      const vaultBalanceAfter = await mockERC20.read.balanceOf([vault.address]);
      assert.equal(vaultBalanceAfter, vaultBalanceBefore + withdrawAmount, "Vault should receive withdrawn tokens");
    });

    void it("Step 6: Verify final balances after withdraw", async function () {
      const { alice, vault, mockERC20, mockStrategist } = context;

      const aliceShares = await vault.read.balanceOf([alice.account.address]);
      const vaultBalance = await mockERC20.read.balanceOf([vault.address]);
      const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);

      // Alice still has all her shares
      assert.equal(aliceShares, DEPOSIT_AMOUNT, "Alice should still have all shares");

      // Vault should have 80 tokens (50 + 30 withdrawn), strategist should have 20 tokens (50 - 30 withdrawn)
      assert.equal(vaultBalance, 80n * ONE_TOKEN, "Vault should have 80 tokens");
      assert.equal(strategistBalance, 20n * ONE_TOKEN, "Strategist should have 20 tokens");

      // Total value is preserved: vault (80) + strategist (20) = 100 tokens
      assert.equal(vaultBalance + strategistBalance, DEPOSIT_AMOUNT, "Total value should be preserved");
    });
  });

  /**
   * Scenario 2: Operator claims rewards for user
   * Tests the new claimRewardsFor function
   */
  void describe("Operator Claims Rewards for User", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Alice should receive shares");
    });

    void it("Step 2: Admin adds reward token and notifies rewards", async function () {
      const { mockERC20, distributor, deployer } = context;

      const rewardDuration = 7n * 24n * 60n * 60n; // 7 days
      await distributor.write.addReward([mockERC20.address, rewardDuration]);

      const rewardAmount = 7n * ONE_TOKEN;
      await distributor.write.notifyRewardAmount([mockERC20.address, rewardAmount]);

      // Transfer rewards to distributor
      await mockERC20.write.transfer([distributor.address, rewardAmount], {
        account: deployer.account,
      });
    });

    void it("Step 3: Wait 1 day - Alice earns rewards", async function () {
      const { mockERC20, distributor, alice, networkHelpers } = context;

      await networkHelpers.time.increase(24 * 60 * 60); // 1 day

      const earned = await distributor.read.earned([alice.account.address, mockERC20.address]);
      assertApproxEqual(earned, ONE_TOKEN, "Alice should earn ~1 token after 1 day");
    });

    void it("Step 4: Operator claims rewards for Alice (rewards go to Alice)", async function () {
      const { mockERC20, distributor, alice, deployer } = context;

      const aliceBalanceBefore = await mockERC20.read.balanceOf([alice.account.address]);
      const operatorBalanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);

      // Operator claims for Alice using claimRewardsFor
      await distributor.write.claimRewardsFor([alice.account.address, [mockERC20.address]], {
        account: deployer.account,
      });

      const aliceBalanceAfter = await mockERC20.read.balanceOf([alice.account.address]);
      const operatorBalanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);

      // Verify Alice received rewards
      assert.ok(aliceBalanceAfter > aliceBalanceBefore, "Alice should receive rewards");
      assertApproxEqual(aliceBalanceAfter - aliceBalanceBefore, ONE_TOKEN, "Alice should receive ~1 token");

      // Verify operator did NOT receive rewards
      assert.equal(operatorBalanceAfter, operatorBalanceBefore, "Operator balance should not change");
    });

    void it("Step 5: Verify earned balance is reset", async function () {
      const { mockERC20, distributor, alice } = context;

      const earned = await distributor.read.earned([alice.account.address, mockERC20.address]);
      assertApproxEqual(earned, 0n, "Earned should be reset to 0", 5n);
    });
  });

  /**
   * Scenario 3: Operator claims compound fees
   * Tests compound fee claiming after third-party compounding
   */
  void describe("Operator Claims Compound Fees", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();

      // Set compound fee to 10% (1000 bps)
      const { distributor, deployer } = context;
      await distributor.write.setCompoundFee([1000n], { account: deployer.account });
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      assert.equal(result.shares, DEPOSIT_AMOUNT, "Alice should receive shares");
    });

    void it("Step 2: Setup rewards for base asset", async function () {
      const { mockERC20, distributor, deployer } = context;

      const rewardDuration = 7n * 24n * 60n * 60n;
      await distributor.write.addReward([mockERC20.address, rewardDuration]);

      const rewardAmount = 10n * ONE_TOKEN;
      await distributor.write.notifyRewardAmount([mockERC20.address, rewardAmount]);
      await mockERC20.write.transfer([distributor.address, rewardAmount], {
        account: deployer.account,
      });
    });

    void it("Step 3: Alice allows third-party compounding", async function () {
      const { distributor, alice } = context;

      await distributor.write.setAllowThirdPartyCompound([true], { account: alice.account });

      const allowed = await distributor.read.allowThirdPartyCompound([alice.account.address]);
      assert.equal(allowed, true, "Alice should allow third-party compounding");
    });

    void it("Step 4: Operator compounds for Alice (fee accrues)", async function () {
      const { distributor, alice, deployer, networkHelpers, mockERC20 } = context;

      await networkHelpers.time.increase(24 * 60 * 60); // 1 day

      const earnedBefore = await distributor.read.earned([alice.account.address, mockERC20.address]);
      assert.ok(earnedBefore > 0n, "Alice should have earned rewards");

      // Operator compounds for Alice
      await distributor.write.compoundReward([alice.account.address], {
        account: deployer.account,
      });

      // Verify fee was accrued to operator
      const claimableFees = await distributor.read.claimableCompoundFees([deployer.account.address]);
      const expectedFee = (earnedBefore * 1000n) / 10000n; // 10% of earned

      assertApproxEqual(claimableFees, expectedFee, "Operator should have ~10% fee accrued");
    });

    void it("Step 5: Operator claims accumulated compound fees", async function () {
      const { distributor, deployer, mockERC20 } = context;

      const operatorBalanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);
      const claimableFeeBefore = await distributor.read.claimableCompoundFees([deployer.account.address]);

      assert.ok(claimableFeeBefore > 0n, "Operator should have claimable fees");

      // Claim compound fees
      await distributor.write.claimCompoundFees({ account: deployer.account });

      const operatorBalanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);
      const claimableFeeAfter = await distributor.read.claimableCompoundFees([deployer.account.address]);

      // Verify fees were claimed
      assert.equal(claimableFeeAfter, 0n, "Claimable fees should be 0 after claim");
      assertApproxEqual(
        operatorBalanceAfter - operatorBalanceBefore,
        claimableFeeBefore,
        "Operator should receive claimed fees",
      );
    });
  });

  /**
   * Scenario 4: Multiple users with strategy rebalancing
   */
  void describe("Multi-User with Strategy Rebalancing", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice and Bob deposit 100 tokens each", async function () {
      const { alice, bob, vault } = context;

      await depositTokens(context, DEPOSIT_AMOUNT, alice.account);
      await depositTokens(context, DEPOSIT_AMOUNT, bob.account);

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 200n * ONE_TOKEN, "Total supply should be 200 tokens");
    });

    void it("Step 2: Manager approves and deposits 100 tokens to strategy via Merkle", async function () {
      const { mockERC20, manager, vault, mockStrategist } = context;

      // First approve strategist
      const approveLeafData = await readLeaf(PARAMETERS_ID, {
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

      // Then deposit to strategist
      const depositAmount = 100n * ONE_TOKEN;
      const depositLeafData = await readLeaf(PARAMETERS_ID, {
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
        args: [mockERC20.address, depositAmount],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [depositLeafData.proof],
        [depositLeafData.leaf.DecoderAndSanitizerAddress],
        [depositLeafData.leaf.TargetAddress as `0x${string}`],
        [depositCalldata],
        [0n],
      ]);

      const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);
      assert.ok(strategistBalance >= depositAmount, "Strategist should have at least 100 tokens");
    });

    void it("Step 3: Manager withdraws 50 tokens from strategy via Merkle", async function () {
      const { mockERC20, manager, vault } = context;

      const withdrawAmount = 50n * ONE_TOKEN;
      const vaultBalanceBefore = await mockERC20.read.balanceOf([vault.address]);

      const withdrawLeafData = await readLeaf(PARAMETERS_ID, {
        FunctionSignature: "withdraw(address,uint256)",
        Description: "Withdraw from PrimeStrategist back to vault",
      });
      assert.ok(withdrawLeafData, "Withdraw leaf not found");

      const withdrawCalldata = encodeFunctionData({
        abi: [
          {
            name: "withdraw",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "asset", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [],
          },
        ],
        functionName: "withdraw",
        args: [mockERC20.address, withdrawAmount],
      });

      await manager.write.manageVaultWithMerkleVerification([
        [withdrawLeafData.proof],
        [withdrawLeafData.leaf.DecoderAndSanitizerAddress],
        [withdrawLeafData.leaf.TargetAddress as `0x${string}`],
        [withdrawCalldata],
        [0n],
      ]);

      const vaultBalanceAfter = await mockERC20.read.balanceOf([vault.address]);
      assert.equal(vaultBalanceAfter, vaultBalanceBefore + withdrawAmount, "Vault should receive 50 tokens");
    });

    void it("Step 4: Verify total value is preserved across vault and strategy", async function () {
      const { alice, bob, vault, mockERC20, mockStrategist } = context;

      const aliceShares = await vault.read.balanceOf([alice.account.address]);
      const bobShares = await vault.read.balanceOf([bob.account.address]);
      const vaultBalance = await mockERC20.read.balanceOf([vault.address]);
      const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);

      // Both users still have their shares
      assert.equal(aliceShares, DEPOSIT_AMOUNT, "Alice should have all shares");
      assert.equal(bobShares, DEPOSIT_AMOUNT, "Bob should have all shares");

      // Total value preserved: vault (150) + strategist (50) = 200 tokens
      const totalValue = vaultBalance + strategistBalance;
      assert.ok(totalValue >= 200n * ONE_TOKEN, "Total value should be at least 200 tokens");
    });
  });
});
