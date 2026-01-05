import { NetworkConnection } from "hardhat/types/network";

import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function log(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const tellers = await connection.viem.getContractAt("TellerWithBuffer", parameters.$global.TellerAddress);

  const tellerDepositBufferHelper = await tellers.read.bufferHelpers();

  console.log("tellerDepositBufferHelper:", tellerDepositBufferHelper);
}

// pnpm hardhat run scripts/tasks/log.ts --network <network>
runHardhatCmd("scripts/tasks/log.ts")
  .then(async (context) => {
    if (!context) return;
    await log(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
