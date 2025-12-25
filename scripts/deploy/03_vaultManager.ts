import { NetworkConnection } from "hardhat/types/network";

import PrimeManagerModule from "../../ignition/modules/Manager.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { createMerkleTree } from "../createMerkleTree.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Vault, Accountant, Teller, Withdrawer, Manager, Registry, RolesAuthority
 */
export default async function deployPrimeManager(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const tree = await createMerkleTree(parameters);
  parameters.ManagerModule = {
    manageRoot: tree.root,
    leafs: tree.leafs,
  };
  await writeParams(parameterId, parameters);

  // Deploy Manager
  const { manager } = await connection.ignition.deploy(PrimeManagerModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global.ManagerAddress = manager.address;
  await writeParams(parameterId, parameters);

  if (displayUi) console.table({ Manager: manager.address });
  return { manager };
}

// pnpm hardhat run scripts/deploy/03_vaultManager.ts --network <network>
runHardhatCmd("scripts/deploy/03_vaultManager.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n🚀 Deploying Prime Manager module...\n");
    await deployPrimeManager(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
