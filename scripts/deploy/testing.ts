import { network } from "hardhat";

import deployMocks from "./00_mock.js";
import deployPrimeRegistry from "./01_primeRegistry.js";
import deployPrimeVault from "./02_primeVault.js";
import deployPrimeManager from "./03_vaultManager.js";

export const PARAMETERS_ID = "localhost-usd";

export async function initializeTest() {
  const connection = await network.connect();
  const [deployer, alice, bob] = await connection.viem.getWalletClients();

  // Deploy mocks
  const mocks = await deployMocks(connection, PARAMETERS_ID);

  // Mint tokens: deployer for rewards, alice/bob for deposits (100 tokens each)
  await mocks.mockERC20.write.mint([deployer.account.address, 1000n * 10n ** 18n]);
  await mocks.mockERC20.write.mint([alice.account.address, 1000n * 10n ** 18n]);
  await mocks.mockERC20.write.mint([bob.account.address, 1000n * 10n ** 18n]);

  // Deploy full system (vault + accountant + teller + manager)
  await deployPrimeRegistry(connection, PARAMETERS_ID, false);
  const primeModules = await deployPrimeVault(connection, PARAMETERS_ID);
  const managerModules = await deployPrimeManager(connection, PARAMETERS_ID);

  console.table({
    MockERC20: mocks.mockERC20.address,
    MockStrategist: mocks.mockStrategist.address,
    PrimeRBAC: primeModules.primeRBAC.address,
    PrimeRegistry: primeModules.primeRegistry.address,
    DecoderAndSanitizer: primeModules.decoder.address,
    PrimeVault: primeModules.vault.address,
    PrimeTeller: primeModules.teller.address,
    PrimeAccountant: primeModules.accountant.address,
    VaultManager: managerModules.manager.address,
  });
}

// pnpm hardhat run scripts/deploy/testing.ts --network localhost
initializeTest().catch((error) => {
  console.error(error);
});
