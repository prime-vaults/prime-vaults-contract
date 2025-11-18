import { network } from "hardhat";

import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

export const ONE_DAY_SECS = 24n * 60n * 60n;
export const ONE_TOKEN = 10n ** 18n;
export const PARAMETERS_ID = "localhost-usd";

export async function initializeTest() {
  const connection = await network.connect();
  const [deployer] = await connection.viem.getWalletClients();

  // Deploy mocks
  const mocks = await deployMocks(connection, PARAMETERS_ID);

  // Mint tokens to deployer
  await mocks.mockERC20.write.mint([deployer.account.address, 10000n * 10n ** 18n]);

  // Deploy full system (vault + accountant + teller + manager)
  const primeModules = await deployPrimeVault(connection, PARAMETERS_ID, {
    stakingToken: mocks.mockERC20.address,
    primeStrategistAddress: mocks.mockStrategist.address,
  });

  return {
    deployer,
    connection,
    networkHelpers: connection.networkHelpers,
    ...mocks,
    ...primeModules,
  };
}
