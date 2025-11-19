import { NetworkConnection } from "hardhat/types/network";

import PrimeRegistryModule from "../../ignition/modules/PrimeRegistry.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Registry Module
 * Deploys: PrimeRBAC, PrimeRegistry, FullDecoderAndSanitizer
 */
export default async function deployPrimeRegistry(
  connection: NetworkConnection,
  parameterId: string,
  displayUi = false,
) {
  const modules = await connection.ignition.deploy(PrimeRegistryModule, {
    displayUi,
    deploymentId: parameterId,
  });

  const [deployer] = await connection.viem.getWalletClients();
  const parameters = readParams(parameterId);
  parameters.$global.adminAddress = deployer.account.address;
  parameters.$global.PrimeRBAC = modules.primeRBAC.address;
  parameters.$global.PrimeRegistryAddress = modules.primeRegistry.address;
  parameters.$global.DecoderAndSanitizerAddress = modules.decoder.address;
  await writeParams(parameterId, parameters);

  if (displayUi) {
    console.table({
      PrimeRBAC: modules.primeRBAC.address,
      PrimeRegistry: modules.primeRegistry.address,
      DecoderAndSanitizer: modules.decoder.address,
    });
  }

  return modules;
}

// pnpm hardhat run scripts/deploy/01_primeRegistry.ts --network <network>
runHardhatCmd("scripts/deploy/01_primeRegistry.ts")
  .then(async (context) => {
    if (!context) return;
    await deployPrimeRegistry(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
