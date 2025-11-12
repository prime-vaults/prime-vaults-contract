import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * PrimeRegistry Module
 * Deploys the registry contracts that track all Prime Vault deployments
 */
export default buildModule("PrimeRegistryModule", (m) => {
  // Deploy PrimeRBAC for role management across vaults
  const primeRBAC = m.contract("PrimeRBAC");

  // Deploy PrimeRegistry for vault tracking
  const primeRegistry = m.contract("PrimeRegistry", [primeRBAC], {
    after: [primeRBAC],
  });

  return { primeRegistry, primeRBAC };
});
