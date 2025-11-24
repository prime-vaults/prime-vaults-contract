import { NetworkConnection } from "hardhat/types/network";

import VaultModule from "../../ignition/modules/vault/Vault.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Vault, Accountant, Teller, Withdrawer, Manager, Registry, RolesAuthority
 */
export default async function deployPrimeVault(connection: NetworkConnection, parameterId: string, displayUi = false) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const parameters = readParams(parameterId);

  // Deploy all vault modules
  const modules = await connection.ignition.deploy(VaultModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });

  // Save deployed addresses
  parameters.$global = {
    ...parameters.$global,
    BoringVaultAddress: modules.vault.address,
    RolesAuthorityAddress: modules.rolesAuthority.address,
  };

  await writeParams(parameterId, parameters);

  return modules;
}

// pnpm hardhat run scripts/deploy/02.1_boringVault.ts --network <network>
runHardhatCmd("scripts/deploy/02.1_boringVault.ts")
  .then(async (context) => {
    if (!context) return;
    await deployPrimeVault(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
