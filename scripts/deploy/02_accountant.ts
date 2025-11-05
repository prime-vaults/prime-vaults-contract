import hre from "hardhat";
import path from "path";

import AccountantModule from "../../ignition/modules/Accountant.js";

export default async function main() {
  const con = await hre.network.connect({});

  const { accountant } = await con.ignition.deploy(AccountantModule, {
    // This must be an absolute path to your parameters JSON file
    parameters: path.resolve(import.meta.dirname, `../../ignition/parameters/${con.networkName}-usd.json`),
    displayUi: true,
  });

  return { accountant };
}

main().catch(console.error);
