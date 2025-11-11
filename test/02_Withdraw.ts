import { network } from "hardhat";
import { describe, it } from "node:test";
import path from "path";

import MockERc20Module from "../ignition/modules/MockERC20.js";
import MockStrategistModule from "../ignition/modules/MockStrategist.js";
import PrimeFactoryModudle from "../ignition/modules/PrimeFactory.js";

void describe("Withdraw", function () {
  const parameters = path.resolve(import.meta.dirname, `../ignition/parameters/localhost-usd.json`);

  async function initialize() {
    const connection = await network.connect();
    const { ignition, viem } = connection;
    const [_deployer] = await viem.getWalletClients();
    const { mockERC20 } = await ignition.deploy(MockERc20Module, { parameters, displayUi: true });
    const { mockStrategist } = await ignition.deploy(MockStrategistModule, { parameters, displayUi: true });
    const factory = await ignition.deploy(PrimeFactoryModudle, { parameters, displayUi: true });
    return { connection, mockERC20, mockStrategist, _deployer, ...factory };
  }

  void it("Should withdraw", async function () {
    const { mockERC20, connection, teller, vault, _deployer, withdrawer } = await initialize();

    const { networkHelpers } = connection;

    await mockERC20.write.approve([vault.address, 10n ** 18n]);
    await teller.write.deposit([10n ** 18n, 0n, vault.address]);
    const shares = await vault.read.balanceOf([_deployer.account.address]);
    console.log("Staked shares:", shares);
    // Approve withdrawer to transfer vault shares (not mockERC20)
    await vault.write.approve([withdrawer.address, shares]);
    // Request withdraw - first param is the asset (mockERC20), second is vault shares amount
    await withdrawer.write.requestWithdraw([mockERC20.address, shares, false]);
    await networkHelpers.time.increase(1 * 24 * 60 * 60); // Increase time by 1 day
    // Execute withdraw
    await withdrawer.write.completeWithdraw([mockERC20.address, _deployer.account.address]);

    // const finalBalance = await mockERC20.read.balanceOf([_deployer.account.address]);
    // console.log("Final mockERC20 balance:", finalBalance);
  });
});
