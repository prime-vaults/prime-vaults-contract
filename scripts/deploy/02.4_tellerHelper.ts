import { NetworkConnection } from "hardhat/types/network";

import TellerHelperModule from "../../ignition/modules/vault/TellerHelper.js";
import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: PrimeBufferHelper
 */
export default async function deployTellerHelper(
  connection: NetworkConnection,
  parameterId: string,
  displayUi = false,
) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const { primeBufferHelper } = await connection.ignition.deploy(TellerHelperModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });

  return { primeBufferHelper };
}

// pnpm hardhat run scripts/deploy/02.4_tellerHelper.ts --network <network>
runHardhatCmd("scripts/deploy/02.4_tellerHelper.ts")
  .then(async (context) => {
    if (!context) return;
    await deployTellerHelper(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
