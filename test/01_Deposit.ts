import { network } from "hardhat";
import { describe, it } from "node:test";

import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

void describe("01_Deposit", function () {
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

  void it("Should deposit and receive shares", async function () {
    const { mockERC20, vault, teller, deployer } = await initialize();

    console.log("\n=== Depositing tokens to vault ===");
    const depositAmount = 10n ** 18n;

    await mockERC20.write.approve([vault.address, depositAmount]);
    await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

    const shares = await vault.read.balanceOf([deployer.account.address]);
    console.log("✅ Deposited:", depositAmount.toString());
    console.log("✅ Received shares:", shares.toString());
  });
});
