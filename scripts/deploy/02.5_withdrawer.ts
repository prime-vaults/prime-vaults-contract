import { NetworkConnection } from "hardhat/types/network";

import WithdrawerModule from "../../ignition/modules/vault/Withdrawer.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Withdrawer
 */
export default async function deployWithdrawer(connection: NetworkConnection, parameterId: string, displayUi = false) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const { withdrawer } = await connection.ignition.deploy(WithdrawerModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global = {
    ...parameters.$global,
    WithdrawerAddress: withdrawer.address,
  };
  await writeParams(parameterId, parameters);

  return { withdrawer };
}

// pnpm hardhat run scripts/deploy/02.5_withdrawer.ts --network <network>
runHardhatCmd("scripts/deploy/02.5_withdrawer.ts")
  .then(async (context) => {
    if (!context) return;
    await deployWithdrawer(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
