import hre from "hardhat";
import path from "path";

import VaultUSDModule from "../../ignition/modules/Vault.js";

export default async function main() {
  const con = await hre.network.connect({});
  const [adminClient] = await con.viem.getWalletClients();
  console.log("adminClient", adminClient);

  const { vault } = await con.ignition.deploy(VaultUSDModule, {
    // This must be an absolute path to your parameters JSON file
    parameters: path.resolve(import.meta.dirname, `../../ignition/parameters/${con.networkName}-usd.json`),
    displayUi: true,
  });

  return { vault };
}

main().catch(console.error);
