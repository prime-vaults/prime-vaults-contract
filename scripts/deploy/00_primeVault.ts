import { NetworkManager } from "hardhat/types/network";

import MockERC20Module from "../../ignition/modules/MockERC20.js";

export default async function deployPrimeVault(network: NetworkManager, paramsPath: string) {
  const connection = await network.connect();
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    displayUi: true,
  });
  return { mockERC20 };
}
