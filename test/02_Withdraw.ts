import { network } from "hardhat";
import { describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readLeaf } from "../scripts/createMerkleTree.js";
import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

void describe("02_Withdraw", function () {
  const PARAMETERS_ID = "localhost-usd";

  async function initialize() {
    const connection = await network.connect();
    const [deployer] = await connection.viem.getWalletClients();

    const mocks = await deployMocks(connection, PARAMETERS_ID);
    await mocks.mockERC20.write.mint([deployer.account.address, 10000n * 10n ** 18n]);

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

  void it("Should deposit to vault, move to PrimeStrategist, then withdraw", async function () {
    const { mockERC20, teller, vault, deployer, withdrawer, networkHelpers, manager, mockStrategist } =
      await initialize();

    console.log("\n=== Step 1: User deposits tokens ===");
    const depositAmount = 1000n * 10n ** 18n;
    await mockERC20.write.approve([vault.address, depositAmount]);
    await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

    const shares = await vault.read.balanceOf([deployer.account.address]);
    console.log("✅ Deposited:", depositAmount.toString());
    console.log("✅ Received shares:", shares.toString());

    console.log("\n=== Step 2: Approve PrimeStrategist via Merkle ===");
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
    console.log("✅ Approved PrimeStrategist");

    console.log("\n=== Step 3: Deposit to PrimeStrategist ===");
    const depositToPrimeAmount = 500n * 10n ** 18n;
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
    console.log("✅ Deposited:", depositToPrimeAmount.toString());

    console.log("\n=== Step 4: Request withdrawal ===");
    await vault.write.approve([withdrawer.address, shares]);
    await withdrawer.write.requestWithdraw([mockERC20.address, shares, false]);
    console.log("✅ Withdrawal requested");

    console.log("\n=== Step 5: Wait delay ===");
    await networkHelpers.time.increase(1 * 24 * 60 * 60);
    console.log("✅ Delay passed");

    console.log("\n=== Step 6: Complete withdrawal (PrimeBufferHelper auto-withdraws from strategist) ===");
    await withdrawer.write.completeWithdraw([mockERC20.address, deployer.account.address]);

    const finalBalance = await mockERC20.read.balanceOf([deployer.account.address]);
    console.log("✅ Final balance:", finalBalance.toString());
  });
});
