import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import VaultModule from "./Vault.js";

/**
 * Manager Module
 * Deploys ManagerWithMerkleVerification for secure strategy execution
 */
export default buildModule("ManagerModule", (m) => {
  const { vault, primeRegistry, rolesAuthority, primeRBAC } = m.useModule(VaultModule);

  // Deploy Manager
  const manager = m.contract("ManagerWithMerkleVerification", [primeRBAC, vault]);

  m.call(primeRegistry, "registerManager", [manager], { id: "registerManager" });

  // Grant STRATEGIST_ROLE to admin for testing/setup
  // m.call(rolesAuthority, "setUserRole", [adminAddress, STRATEGIST_ROLE, true], {
  //   id: "setUserRole_admin_strategistRole",
  // });

  return { manager, vault, primeRegistry, rolesAuthority };
});
