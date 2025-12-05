import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../constants.js";

/**
 * Manager Module
 * Deploys ManagerWithMerkleVerification for secure strategy execution
 */
export default buildModule("ManagerModule", (m) => {
  const adminAddress = m.getParameter("adminAddress");
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const rolesAuthority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

  // Deploy Manager
  const manager = m.contract("ManagerWithMerkleVerification", [m.getParameter("PrimeRBAC"), vault]);

  m.call(manager, "setManageRoot", [adminAddress, m.getParameter("manageRoot")]);

  // Set role capability for manageVaultWithMerkleVerification
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [ROLES.STRATEGIST, manager, toFunctionSelector("manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])"), true],
    { id: "setRoleCapability_manageVaultWithMerkleVerification" },
  );

  // Grant MANAGER_ROLE to manager contract (so it can call vault.manage())
  m.call(rolesAuthority, "setUserRole", [manager, ROLES.MANAGER, true], { id: "setUserRole_MANAGER_Manager" });

  // Grant STRATEGIST_ROLE to admin so they can call manageVaultWithMerkleVerification
  m.call(rolesAuthority, "setUserRole", [adminAddress, ROLES.STRATEGIST, true], { id: "setUserRole_STRATEGIST_Admin" });

  return { manager, vault };
});
