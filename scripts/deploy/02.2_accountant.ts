import { NetworkConnection } from "hardhat/types/network";

import AccountantModule from "../../ignition/modules/vault/Accountant.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Accountant
 */
export default async function deployAccountant(connection: NetworkConnection, parameterId: string, displayUi = false) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  // Deploy all vault modules
  const { accountant } = await connection.ignition.deploy(AccountantModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global = {
    ...parameters.$global,
    AccountantAddress: accountant.address,
  };
  await writeParams(parameterId, parameters);

  return { accountant };
}

// pnpm hardhat run scripts/deploy/02.2_accountant.ts --network <network>
runHardhatCmd("scripts/deploy/02.2_accountant.ts")
  .then(async (context) => {
    if (!context) return;
    await deployAccountant(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
