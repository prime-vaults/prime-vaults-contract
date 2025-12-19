import { NetworkConnection } from "hardhat/types/network";

import PrimeTimelockModule from "../../ignition/modules/governance/PrimeTimelock.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";

/**
 * Deploy PrimeTimelock for role management
 *
 * This timelock controls OWNER_ROLE to prevent instant rug pulls via role changes.
 * Requires 48h delay for all role grants/revokes.
 */
export default async function deployTimelock(connection: NetworkConnection, parameterId: string) {
  const parameters = readParams(parameterId);

  // Deploy via Ignition with inline parameters

  const { timelock } = await connection.ignition.deploy(PrimeTimelockModule, { parameters, deploymentId: parameterId });

  // Save to global parameters
  parameters.$global.PrimeTimelockAddress = timelock.address;
  await writeParams(parameterId, parameters);

  return { timelock };
}
