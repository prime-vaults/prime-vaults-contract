import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import VaultModule from "./vault/Vault.js";

/**
 * Manager Module
 * Deploys ManagerWithMerkleVerification for secure strategy execution
 */
export default buildModule("ManagerModule", (m) => {
  const { vault, primeRegistry, primeRBAC } = m.useModule(VaultModule);

  // Deploy Manager
  const manager = m.contract("ManagerWithMerkleVerification", [primeRBAC, vault]);
  m.call(primeRegistry, "registerManager", [manager], { id: "registerManager" });
  return { manager };
});
