import { NetworkConnection } from "hardhat/types/network";

import PrimeFactoryModule from "../../ignition/modules/PrimeFactory.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { createMerkleTree } from "../createMerkleTree.js";

export default async function deployPrimeVault(
  connection: NetworkConnection,
  parameterId: string,
  payload: { stakingToken: `0x${string}`; primeStrategistAddress: `0x${string}` },
) {
  const parameters = readParams(parameterId);
  parameters.$global.stakingToken = payload.stakingToken;
  parameters.$global.PrimeStrategistAddress = payload.primeStrategistAddress;
  writeParams(parameterId, parameters);

  const modules = await connection.ignition.deploy(PrimeFactoryModule, {
    parameters,
    displayUi: true,
  });

  parameters.$metadata = {
    BoringVaultAddress: modules.vault.address,
    AccountantAddress: modules.accountant.address,
    TellerAddress: modules.teller.address,
    WithdrawerAddress: modules.withdrawer.address,
    ManagerAddress: modules.manager.address,
    PrimeRegistryAddress: modules.primeRegistry.address,
    RolesAuthorityAddress: modules.rolesAuthority.address,
    ManageRoot: "0x",
    leafs: [],
  };
  console.table(parameters.$metadata);
  await writeParams(parameterId, parameters);

  const { ManageRoot } = createMerkleTree(parameterId);
  await modules.manager.write.setManageRoot([parameters.$global.adminAddress, ManageRoot]);

  return modules;
}
