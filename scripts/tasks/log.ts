import { NetworkConnection } from "hardhat/types/network";
import { keccak256 } from "viem";

import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function log(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const parameters = readParams(parameterId);

  const primeRBAC = await connection.viem.getContractAt("PrimeRBAC", parameters.$global.PrimeRBAC);

  const admins = await primeRBAC.read.getRoleMembers([keccak256("PROTOCOL_ADMIN_ROLE" as any)]);
  const operator = await primeRBAC.read.getRoleMembers([keccak256("OPERATOR_ROLE" as any)]);
  console.log("Protocol Admins:", admins);
  console.log("Operators:", operator);
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
