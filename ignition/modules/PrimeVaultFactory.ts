import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PrimeVaultsFactoryModule", (m) => {
  const primeVaultFactory = m.contract("PrimeVaultFactory", []);
  return { primeVaultFactory };
});
