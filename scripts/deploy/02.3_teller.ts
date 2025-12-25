import { NetworkConnection } from "hardhat/types/network";

import TellerModule from "../../ignition/modules/vault/Teller.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Vault, Accountant, Teller, Withdrawer, Manager, Registry, RolesAuthority
 */
export default async function deployTeller(connection: NetworkConnection, parameterId: string, displayUi = false) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const { teller } = await connection.ignition.deploy(TellerModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global = {
    ...parameters.$global,
    TellerAddress: teller.address,
  };
  await writeParams(parameterId, parameters);

  return { teller };
}

// pnpm hardhat run scripts/deploy/02.3_teller.ts --network <network>
runHardhatCmd("scripts/deploy/02.3_teller.ts")
  .then(async (context) => {
    if (!context) return;
    await deployTeller(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
