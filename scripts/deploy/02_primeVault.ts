import { NetworkConnection } from "hardhat/types/network";

import PrimeFactoryModule from "../../ignition/modules/PrimeFactory.js";
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
  const modules = await connection.ignition.deploy(PrimeFactoryModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });

  // Save deployed addresses
  parameters.$global = {
    ...parameters.$global,
    BoringVaultAddress: modules.vault.address,
    AccountantAddress: modules.accountant.address,
    TellerAddress: modules.teller.address,
    WithdrawerAddress: modules.withdrawer.address,
    RolesAuthorityAddress: modules.rolesAuthority.address,
  };

  await writeParams(parameterId, parameters);

  return modules;
}

// pnpm hardhat run scripts/deploy/02_primeVault.ts --network <network>
runHardhatCmd("scripts/deploy/02_primeVault.ts")
  .then(async (context) => {
    if (!context) return;
    await deployPrimeVault(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
