import hre from "hardhat";
import path from "path";

import MockERC20Module from "../../ignition/modules/MockERC20.js";

export default async function main() {
  const connection = await hre.network.connect();

  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    // This must be an absolute path to your parameters JSON file
    parameters: path.resolve(import.meta.dirname, `../../ignition/parameters/${connection.networkName}.json`),
    displayUi: true,
  });

  return { mockERC20 };
}

main().catch(console.error);
