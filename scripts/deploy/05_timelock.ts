import { NetworkConnection } from "hardhat/types/network";

import PrimeTimelockModule from "../../ignition/modules/governance/PrimeTimelock.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy PrimeTimelock for role management
 *
 * This timelock controls OWNER_ROLE to prevent instant rug pulls via role changes.
 * Requires 48h delay for all role grants/revokes.
 */
export default async function deployTimelock(connection: NetworkConnection, parameterId: string) {
  const parameters = await readParams(parameterId);

  // Deploy via Ignition with inline parameters

  const { timelock } = await connection.ignition.deploy(PrimeTimelockModule, { parameters, deploymentId: parameterId });

  // Save to global parameters
  parameters.$global.PrimeTimeLockAddress = timelock.address;
  await writeParams(parameterId, parameters);

  return { timelock };
}

// pnpm hardhat run scripts/deploy/05_timelock.ts --network <network>
runHardhatCmd("scripts/deploy/05_timelock.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n🚀 Deploying Prime Timelock module...\n");
    await deployTimelock(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
