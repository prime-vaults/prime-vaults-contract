import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying SmartAccountRegistry
 *
 * This module deploys the SmartAccountRegistry contract which allows
 * ERC-4337 smart accounts to register their owner addresses on-chain.
 */
const SmartAccountRegistryModule = buildModule("SmartAccountRegistryModule", (m) => {
  // Deploy SmartAccountRegistry
  const smartAccountRegistry = m.contract("SmartAccountRegistry", []);

  return { smartAccountRegistry };
});

export default SmartAccountRegistryModule;
