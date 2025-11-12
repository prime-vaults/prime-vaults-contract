import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import VaultModule from "./Vault.js";

/**
 * Manager Module
 * Deploys ManagerWithMerkleVerification for secure strategy execution
 */
export default buildModule("ManagerModule", (m) => {
  const { vault, primeRegistry, rolesAuthority } = m.useModule(VaultModule);

  // Get role constants
  const adminAddress = m.getParameter("adminAddress");
  const MANAGER_ROLE = m.getParameter("MANAGER_ROLE");
  const STRATEGIST_ROLE = m.getParameter("STRATEGIST_ROLE");

  // Deploy Manager
  const manager = m.contract("ManagerWithMerkleVerification", [primeRegistry, vault]);

  // Link manager to authority
  m.call(manager, "setAuthority", [rolesAuthority], { id: "manager_setAuthority" });

  // Grant STRATEGIST_ROLE permission to call manageVaultWithMerkleVerification
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [
      STRATEGIST_ROLE,
      manager,
      toFunctionSelector("manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])"),
      true,
    ],
    { id: "setRoleCapability_manageVaultWithMerkleVerification" },
  );

  // Grant MANAGER_ROLE to manager contract (so it can call vault.manage())
  m.call(rolesAuthority, "setUserRole", [manager, MANAGER_ROLE, true], {
    id: "setUserRole_manager_managerRole",
  });

  // Grant STRATEGIST_ROLE to admin for testing/setup
  m.call(rolesAuthority, "setUserRole", [adminAddress, STRATEGIST_ROLE, true], {
    id: "setUserRole_admin_strategistRole",
  });

  return { manager, vault, primeRegistry, rolesAuthority };
});
