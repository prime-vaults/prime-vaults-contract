import { network } from "hardhat";
import { before, describe, it } from "node:test";
import path from "path";

import MockERc20Module from "../ignition/modules/MockERC20.js";
import PrimeVaultsFactoryModule from "../ignition/modules/PrimeVaultsFactory.js";

void describe("Deploy", function () {
  const parameters = path.resolve(import.meta.dirname, `../ignition/parameters/localhost-usd.json`);

  before(async function () {
    const { viem } = await network.connect();
    const [_deployer] = await viem.getWalletClients();
    console.log("Deployer address:", await _deployer.account.address);
  });

  void it("Should deploy MockERC20 token", async function () {
    const { ignition } = await network.connect();
    await ignition.deploy(MockERc20Module, { parameters });
  });

  void it("Should deployed", async function () {
    const { ignition, viem } = await network.connect();
    const [_deployer] = await viem.getWalletClients();
    await ignition.deploy(PrimeVaultsFactoryModule, { parameters, displayUi: true });
  });
});
