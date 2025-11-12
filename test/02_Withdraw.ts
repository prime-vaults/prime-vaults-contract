import { network } from "hardhat";
import { describe, it } from "node:test";

import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

void describe("02_Withdraw", function () {
  const PARAMETERS_ID = "localhost-usd";

  async function initialize() {
    const connection = await network.connect();
    const [deployer] = await connection.viem.getWalletClients();

    // Deploy mocks
    const mocks = await deployMocks(connection, PARAMETERS_ID);

    // Mint tokens to deployer
    await mocks.mockERC20.write.mint([deployer.account.address, 10000n * 10n ** 18n]);

    // Deploy full system (vault + accountant + teller + manager)
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

  void it("Should deposit and withdraw", async function () {
    const { mockERC20, teller, vault, deployer, withdrawer, networkHelpers } = await initialize();

    console.log("\n=== Step 1: Depositing tokens ===");
    const depositAmount = 10n ** 18n;
    await mockERC20.write.approve([vault.address, depositAmount]);
    await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

    const shares = await vault.read.balanceOf([deployer.account.address]);
    console.log("✅ Deposited:", depositAmount.toString());
    console.log("✅ Received shares:", shares.toString());

    console.log("\n=== Step 2: Requesting withdrawal ===");
    // Approve withdrawer to transfer vault shares
    await vault.write.approve([withdrawer.address, shares]);

    // Request withdraw - first param is the asset (mockERC20), second is vault shares amount
    await withdrawer.write.requestWithdraw([mockERC20.address, shares, false]);
    console.log("✅ Withdrawal requested");

    console.log("\n=== Step 3: Waiting for delay period ===");
    await networkHelpers.time.increase(1 * 24 * 60 * 60); // Increase time by 1 day
    console.log("✅ Delay period passed");

    console.log("\n=== Step 4: Completing withdrawal ===");
    // Execute withdraw
    await withdrawer.write.completeWithdraw([mockERC20.address, deployer.account.address]);

    const finalBalance = await mockERC20.read.balanceOf([deployer.account.address]);
    console.log("✅ Withdrawal completed");
    console.log("✅ Final balance:", finalBalance.toString());
  });
});
