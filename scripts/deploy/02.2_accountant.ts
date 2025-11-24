import { NetworkConnection } from "hardhat/types/network";

import AccountantModule from "../../ignition/modules/vault/Accountant.js";
import TellerModule from "../../ignition/modules/vault/Teller.js";
import WithdrawerModule from "../../ignition/modules/vault/Withdrawer.js";
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
  const { accountant } = await connection.ignition.deploy(AccountantModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global = {
    ...parameters.$global,
    AccountantAddress: accountant.address,
  };
  await writeParams(parameterId, parameters);

  const { teller } = await connection.ignition.deploy(TellerModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global = {
    ...parameters.$global,
    TellerAddress: teller.address,
  };
  await writeParams(parameterId, parameters);

  const { withdrawer } = await connection.ignition.deploy(WithdrawerModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });
  parameters.$global = {
    ...parameters.$global,
    WithdrawerAddress: withdrawer.address,
  };
  await writeParams(parameterId, parameters);

  return { accountant, teller, withdrawer };
}

// pnpm hardhat run scripts/deploy/02.2_vaultComponents.ts --network <network>
runHardhatCmd("scripts/deploy/02.2_vaultComponents.ts")
  .then(async (context) => {
    if (!context) return;
    await deployPrimeVault(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
