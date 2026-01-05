import hre from "hardhat";
import { NetworkConnection } from "hardhat/types/network";

import PrimeRegistryModule from "../../ignition/modules/PrimeRegistry.js";
import SmartAccountRegistryModule from "../../ignition/modules/account/SmartAccountRegistry.js";
import { writeParams } from "../../ignition/parameters/utils.js";

/**
 * Deploy Prime Registry Module
 * Deploys: PrimeRBAC, PrimeRegistry, FullDecoderAndSanitizer, SmartAccountRegistry
 */
export default async function deployPrimeRegistry(connection: NetworkConnection, displayUi = false) {
  const client = await connection.viem.getPublicClient();
  const networkName = connection.networkName;

  const [deployer] = await connection.viem.getWalletClients();

  // Deploy PrimeRegistry modules
  const modules = await connection.ignition.deploy(PrimeRegistryModule, {
    displayUi,
    deploymentId: networkName,
  });

  // Deploy SmartAccountRegistry
  const accountRegistry = await connection.ignition.deploy(SmartAccountRegistryModule, {
    displayUi,
    deploymentId: networkName,
  });

  await writeParams(connection.networkName, {
    $global: {
      chainId: await client.getChainId(),
      network: connection.networkName,
      adminAddress: deployer.account.address,
      PrimeStrategistAddress: "0x",
      PrimeRBAC: modules.primeRBAC.address,
      DecoderAndSanitizerAddress: modules.decoder.address,
      SmartAccountRegistryAddress: accountRegistry.smartAccountRegistry.address,
      //
      stakingToken: "0x",
      BoringVaultAddress: "0x",
      RolesAuthorityAddress: "0x",
      AccountantAddress: "0x",
      TellerAddress: "0x",
      DistributorAddress: "0x",
      WithdrawerAddress: "0x",
      ManagerAddress: "0x",
      PrimeTimeLockAddress: "0x",
    },
    AccountantModule: {
      platformFee: 0,
    },
    WithdrawerModule: {
      withdrawDelayInSeconds: 259200,
      withdrawFee: 0,
      expeditedWithdrawFee: 200,
    },
    ManagerModule: {} as any,
    VaultModule: { name: "", symbol: "" },
  });
  return { ...modules, ...accountRegistry };
}

// pnpm hardhat run scripts/deploy/01_primeRegistry.ts --network <network>
async function main() {
  const connection = await hre.network.connect();
  await deployPrimeRegistry(connection, true);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
