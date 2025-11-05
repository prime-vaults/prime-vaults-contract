import hre from "hardhat";

import MockERC20Module from "../../ignition/modules/MockERC20.js";

export default async function main() {
  const connection = await hre.network.connect();
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    displayUi: true,
  });
  return { mockERC20 };
}

main().catch(console.error);
