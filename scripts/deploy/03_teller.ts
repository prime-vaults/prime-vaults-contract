import hre from "hardhat";
import path from "path";

import TellerModule from "../../ignition/modules/Teller.js";

export default async function main() {
  const con = await hre.network.connect({});

  const { teller } = await con.ignition.deploy(TellerModule, {
    // This must be an absolute path to your parameters JSON file
    parameters: path.resolve(import.meta.dirname, `../../ignition/parameters/${con.networkName}-usd.json`),
    displayUi: true,
  });

  return { teller };
}

main().catch(console.error);
