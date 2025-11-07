import { network } from "hardhat";
import { describe, it } from "node:test";
import path from "path";

import MockERc20Module from "../ignition/modules/MockERC20.js";
import PrimeVaultsFactoryModule from "../ignition/modules/PrimeVaultsFactory.js";

void describe("Deposit", function () {
  const parameters = path.resolve(import.meta.dirname, `../ignition/parameters/localhost-usd.json`);

  void it("Should stake", async function () {
    const { ignition, viem } = await network.connect();
    const [_deployer] = await viem.getWalletClients();

    const { mockERC20 } = await ignition.deploy(MockERc20Module, { parameters });

    const { teller, vault } = await ignition.deploy(PrimeVaultsFactoryModule, { parameters });

    await mockERC20.write.approve([vault.address, 10n ** 18n]);
    await teller.write.deposit([10n ** 18n, 0n, vault.address]);

    const shares = await vault.read.balanceOf([_deployer.account.address]);
    console.log("Staked shares:", shares);
  });
});
