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
  const parameters = readParams(parameterId);

  // Deploy all vault modules
  const modules = await connection.ignition.deploy(VaultModule, {
    parameters,
    displayUi,
    deploymentId: parameterId,
  });

  const client = await connection.viem.getPublicClient();
  const [deployer] = await connection.viem.getWalletClients();

  // Save deployed addresses
  parameters.$global = {
    chainId: await client.getChainId(),
    network: connection.networkName,
    stakingToken: parameters.$global.stakingToken,
    adminAddress: deployer.account.address,
    PrimeStrategistAddress: parameters.$global.PrimeStrategistAddress,
    PrimeRBAC: parameters.$global.PrimeRBAC,
    DecoderAndSanitizerAddress: parameters.$global.DecoderAndSanitizerAddress,
    //
    BoringVaultAddress: modules.vault.address,
    RolesAuthorityAddress: modules.rolesAuthority.address,
    //
    AccountantAddress: "0x",
    TellerAddress: "0x",
    DistributorAddress: "0x",
    WithdrawerAddress: "0x",
    ManagerAddress: "0x",
  };

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
