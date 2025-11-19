import { NetworkConnection } from "hardhat/types/network";

import PrimeFactoryModule from "../../ignition/modules/PrimeFactory.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { createMerkleTree } from "../createMerkleTree.js";

/**
 * Deploy Prime Vault system
 * Deploys: Vault, Accountant, Teller, Withdrawer, Manager, Registry, RolesAuthority
 */
export default async function deployPrimeVault(
  connection: NetworkConnection,
  parameterId: string,
  payload: { stakingToken: `0x${string}`; primeStrategistAddress: `0x${string}` },
  displayUi = false,
) {
  if (displayUi) console.log("\n🚀 Deploying Prime Vault system...\n");

  // Update parameters with required addresses
  const parameters = readParams(parameterId);
  parameters.$global.stakingToken = payload.stakingToken;
  parameters.$global.PrimeStrategistAddress = payload.primeStrategistAddress;
  await writeParams(parameterId, parameters);

  // Deploy all vault modules
  const modules = await connection.ignition.deploy(PrimeFactoryModule, {
    parameters,
    displayUi,
  });

  // Save deployed addresses
  parameters.$global.DecoderAndSanitizerAddress = modules.decoder.address;
  parameters.$global.PrimeRegistryAddress = modules.primeRegistry.address;
  parameters.$metadata = {
    VaultAddress: modules.vault.address,
    BoringVaultAddress: modules.vault.address,
    AccountantAddress: modules.accountant.address,
    TellerAddress: modules.teller.address,
    WithdrawerAddress: modules.withdrawer.address,
    ManagerAddress: modules.manager.address,
    RolesAuthorityAddress: modules.rolesAuthority.address,
    ManageRoot: "0x",
    leafs: [],
  };

  if (displayUi) {
    console.log("\n✅ Prime Vault deployed:\n");
    console.table(parameters.$metadata);
  }
  await writeParams(parameterId, parameters);

  // Generate and set Merkle root
  const { ManageRoot } = await createMerkleTree(parameterId, displayUi);
  await modules.manager.write.setManageRoot([parameters.$global.adminAddress, ManageRoot]);

  return modules;
}
