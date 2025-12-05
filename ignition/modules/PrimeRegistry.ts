import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * PrimeRegistry Module
 * Deploys the registry contracts that track all Prime Vault deployments
 */
export default buildModule("PrimeRegistryModule", (m) => {
  // Deploy PrimeRBAC for role management across vaults
  const primeRBAC = m.contract("PrimeRBAC");
  // Deploy FullDecoderAndSanitizer for input decoding and sanitization
  const decoder = m.contract("FullDecoderAndSanitizer", [], {
    after: [primeRBAC],
  });
  return { primeRBAC, decoder };
});
