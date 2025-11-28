import { NetworkConnection } from "hardhat/types/network";
import prompts from "prompts";
import { keccak256 } from "viem";

import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function grantRole(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const caller = await connection.viem.getWalletClients();
  const parameters = readParams(parameterId);

  const primeRBAC = await connection.viem.getContractAt("PrimeRBAC", parameters.$global.PrimeRBAC);

  const account = await prompts({
    type: "text",
    name: "account",
    message: `Enter the account to grant the role to:`,
  });

  const role = await prompts({
    type: "text",
    name: "role",
    message: `Enter the role to grant:`,
    initial: caller[0].account.address,
  });

  await primeRBAC.write.grantRole([keccak256(role.role as any), account.account]);
}

// pnpm hardhat run scripts/tasks/grantRole.ts --network <network>
runHardhatCmd("scripts/tasks/grantRole.ts")
  .then(async (context) => {
    if (!context) return;
    await grantRole(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
