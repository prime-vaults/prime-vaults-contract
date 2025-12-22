import { NetworkConnection } from "hardhat/types/network";

import DistributorModule from "../../ignition/modules/Distributor.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function deployDistributor(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  // Deploy Manager
  const { distributor } = await connection.ignition.deploy(DistributorModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });

  parameters.$global.DistributorAddress = distributor.address;
  await writeParams(parameterId, parameters);

  return { distributor };
}

// pnpm hardhat run scripts/deploy/04_distributor.ts --network <network>
runHardhatCmd("scripts/deploy/04_distributor.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n🚀 Deploying Prime Distributor module...\n");
    await deployDistributor(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
