import { NetworkConnection } from "hardhat/types/network";

import { runHardhatCmd } from "../utils.js";
import deployPrimeRegistry from "./01_primeRegistry.js";
import deployBoringVault from "./02.1_boringVault.js";
import deployAccountant from "./02.2_accountant.js";
import deployTeller from "./02.3_teller.js";
import deployTellerHelper from "./02.4_tellerHelper.js";
import deployWithdrawer from "./02.5_withdrawer.js";
import deployPrimeManager from "./03_vaultManager.js";
import deployDistributor from "./04_distributor.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function deployFull(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Update parameters with required addresses

  const primeRegistry = await deployPrimeRegistry(connection, parameterId, displayUi);
  const boringVault = await deployBoringVault(connection, parameterId, displayUi);
  const accountant = await deployAccountant(connection, parameterId, displayUi);
  const teller = await deployTeller(connection, parameterId, displayUi);
  const tellerHelper = await deployTellerHelper(connection, parameterId, displayUi);
  const withdrawer = await deployWithdrawer(connection, parameterId, displayUi);
  const managerModules = await deployPrimeManager(connection, parameterId, displayUi);
  const distributor = await deployDistributor(connection, parameterId, displayUi);

  return {
    distributor,
    ...managerModules,
    ...withdrawer,
    ...tellerHelper,
    ...teller,
    ...accountant,
    ...boringVault,
    ...primeRegistry,
  };
}

// pnpm hardhat run scripts/deploy/full.ts --network <network>
runHardhatCmd("scripts/deploy/full.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n🚀 Deploying Prime Distributor module...\n");
    await deployFull(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
