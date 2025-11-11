import { network } from "hardhat";
import { describe, it } from "node:test";
import path from "path";

import MockERc20Module from "../ignition/modules/MockERC20.js";
import MockStrategistModule from "../ignition/modules/MockStrategist.js";
import PrimeFactoryModule from "../ignition/modules/PrimeFactory.js";

void describe("Deposit", function () {
  const parameters = path.resolve(import.meta.dirname, `../ignition/parameters/localhost-usd.json`);

  async function initialize() {
    const { ignition, viem } = await network.connect();
    const [_deployer] = await viem.getWalletClients();
    const { mockERC20 } = await ignition.deploy(MockERc20Module, { parameters, displayUi: true });

    const { mockStrategist } = await ignition.deploy(MockStrategistModule, { parameters, displayUi: true });

    const modules = await ignition.deploy(PrimeFactoryModule, { parameters, displayUi: true });

    return { ignition, viem, mockERC20, mockStrategist, _deployer, ...modules };
  }

  void it("Should stake", async function () {
    const { mockERC20, vault, teller, _deployer } = await initialize();

    await mockERC20.write.approve([vault.address, 10n ** 18n]);
    await teller.write.deposit([10n ** 18n, 0n, vault.address]);

    const shares = await vault.read.balanceOf([_deployer.account.address]);
    console.log("Staked shares:", shares);
  });
});
