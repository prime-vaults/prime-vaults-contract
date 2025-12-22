import { NetworkConnection } from "hardhat/types/network";

import VaultModule from "../../ignition/modules/vault/Vault.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Vault, RolesAuthority
 */
export default async function deployBoringVault(connection: NetworkConnection, parameterId: string, displayUi = false) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const chainCommon = await readParams(connection.networkName);
  await writeParams(parameterId, chainCommon);
  const parameters = await readParams(parameterId);

  // Deploy all vault modules
  const modules = await connection.ignition.deploy(VaultModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });

  // Save deployed addresses
  parameters.BoringVaultAddress = modules.vault.address;
  parameters.RolesAuthorityAddress = modules.rolesAuthority.address;
  await writeParams(parameterId, parameters);

  return modules;
}

// pnpm hardhat run scripts/deploy/02.1_boringVault.ts --network <network>
runHardhatCmd("scripts/deploy/02.1_boringVault.ts")
  .then(async (context) => {
    if (!context) return;
    await deployBoringVault(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
