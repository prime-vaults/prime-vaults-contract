import { network } from "hardhat";
import { describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

void describe("02_Withdraw - Full Flow with PrimeStrategist", function () {
  const PARAMETERS_ID = "localhost-usd";
  let CONTEXT: Awaited<ReturnType<typeof initialize>>;

  // Shared state across test cases
  let userShares: bigint;
  let depositToPrimeAmount: bigint;
  let initialUserBalance: bigint;
  const depositAmount = 1n * 10n ** 18n; // 1 token

  async function initialize() {
    const connection = await network.connect();
    const [deployer] = await connection.viem.getWalletClients();

    const mocks = await deployMocks(connection, PARAMETERS_ID);
    await mocks.mockERC20.write.mint([deployer.account.address, 1n * 10n ** 18n]); // Mint 1 token

    const primeModules = await deployPrimeVault(connection, PARAMETERS_ID, {
      stakingToken: mocks.mockERC20.address,
      primeStrategistAddress: mocks.mockStrategist.address,
    });

    return {
      deployer,
      networkHelpers: connection.networkHelpers,
      ...mocks,
      ...primeModules,
    };
  }

  void it("Setup: Deploy contracts", async function () {
    CONTEXT = await initialize();
  });

  void it("Step 1: User deposits tokens to vault", async function () {
    const { mockERC20, teller, vault, deployer } = CONTEXT;

    initialUserBalance = await mockERC20.read.balanceOf([deployer.account.address]);

    await mockERC20.write.approve([vault.address, depositAmount]);
    await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

    userShares = await vault.read.balanceOf([deployer.account.address]);
    const balanceAfterDeposit = await mockERC20.read.balanceOf([deployer.account.address]);

    console.table({
      "Initial Balance": initialUserBalance.toString(),
      Deposited: depositAmount.toString(),
      "Balance After": balanceAfterDeposit.toString(),
      "Shares Received": userShares.toString(),
    });

    if (userShares !== depositAmount) {
      throw new Error("Shares mismatch");
    }
  });

  void it("Step 2: Approve PrimeStrategist via Merkle verification", async function () {
    const { manager, mockStrategist } = CONTEXT;

    const approveLeafData = readLeaf(PARAMETERS_ID, {
      FunctionSignature: "approve(address,uint256)",
      Description: "Approve PrimeStrategist to spend base asset (staking token)",
    });

    if (!approveLeafData) {
      throw new Error("Approve leaf not found");
    }

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

  void it("Step 3: Manager deposits assets to PrimeStrategist", async function () {
    const { mockERC20, vault, mockStrategist } = CONTEXT;

    depositToPrimeAmount = 1n * 10n ** 18n; // Deposit all 1 token to strategist

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
      args: [mockERC20.address, depositToPrimeAmount],
    });

    await vault.write.manage([mockStrategist.address, depositCalldata, 0n]);

    const strategistBalance = await mockERC20.read.balanceOf([mockStrategist.address]);
    const vaultBalance = await mockERC20.read.balanceOf([vault.address]);

    console.table({
      "Vault Balance": vaultBalance.toString(),
      "Strategist Balance": strategistBalance.toString(),
      "Total Assets": (vaultBalance + strategistBalance).toString(),
    });

    if (strategistBalance !== depositToPrimeAmount) {
      throw new Error("Strategist balance mismatch");
    }
  });

  void it("Step 4: User requests withdrawal", async function () {
    const { vault, withdrawer, deployer, mockERC20 } = CONTEXT;

    await vault.write.approve([withdrawer.address, userShares]);
    await withdrawer.write.requestWithdraw([mockERC20.address, userShares, false]);

    const withdrawerShares = await vault.read.balanceOf([withdrawer.address]);
    const userSharesAfter = await vault.read.balanceOf([deployer.account.address]);

    console.table({
      "Shares Requested": userShares.toString(),
      "Withdrawer Holds": withdrawerShares.toString(),
      "User Remaining": userSharesAfter.toString(),
    });

    if (withdrawerShares !== userShares) {
      throw new Error("Withdrawer shares mismatch");
    }

    if (userSharesAfter !== 0n) {
      throw new Error("User should have 0 shares after request");
    }
  });

  void it("Step 5: Wait for withdrawal delay period", async function () {
    const { networkHelpers } = CONTEXT;

    await networkHelpers.time.increase(1 * 24 * 60 * 60);
  });

  void it("Step 6: Complete withdrawal with automatic PrimeBufferHelper", async function () {
    const { withdrawer, mockERC20, deployer, mockStrategist, vault } = CONTEXT;

    const userBalanceBefore = await mockERC20.read.balanceOf([deployer.account.address]);
    const vaultBalanceBefore = await mockERC20.read.balanceOf([vault.address]);
    const strategistBalanceBefore = await mockERC20.read.balanceOf([mockStrategist.address]);

    await withdrawer.write.completeWithdraw([mockERC20.address, deployer.account.address]);

    const userBalanceAfter = await mockERC20.read.balanceOf([deployer.account.address]);
    const vaultBalanceAfter = await mockERC20.read.balanceOf([vault.address]);
    const strategistBalanceAfter = await mockERC20.read.balanceOf([mockStrategist.address]);

    console.table({
      "": ["Before", "After", "Δ Change"],
      User: [
        userBalanceBefore.toString(),
        userBalanceAfter.toString(),
        `+${(userBalanceAfter - userBalanceBefore).toString()}`,
      ],
      Vault: [
        vaultBalanceBefore.toString(),
        vaultBalanceAfter.toString(),
        (vaultBalanceAfter - vaultBalanceBefore).toString(),
      ],
      Strategist: [
        strategistBalanceBefore.toString(),
        strategistBalanceAfter.toString(),
        (strategistBalanceAfter - strategistBalanceBefore).toString(),
      ],
    });

    // User should get back initial balance (deposited amount returned)
    const expectedFinalBalance = initialUserBalance;
    if (userBalanceAfter !== expectedFinalBalance) {
      throw new Error(
        `Balance mismatch! Expected: ${expectedFinalBalance}, Got: ${userBalanceAfter}, Diff: ${userBalanceAfter - expectedFinalBalance}`,
      );
    }

    if (strategistBalanceAfter >= strategistBalanceBefore) {
      throw new Error("Strategist balance should have decreased (auto-withdrawal didn't work)");
    }
  });
});
