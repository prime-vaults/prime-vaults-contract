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

  const tx1 = m.call(manager, "setManageRoot", [adminAddress, m.getParameter("manageRoot")], {
    id: "setManageRoot",
    after: [manager],
  });

  // Set role capability for manageVaultWithMerkleVerification
  const tx2 = m.call(
    rolesAuthority,
    "setRoleCapability",
    [ROLES.STRATEGIST, manager, toFunctionSelector("manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])"), true],
    {
      id: "setRoleCapability_manageVaultWithMerkleVerification",
      after: [tx1],
    },
  );

  // Grant MANAGER_ROLE to manager contract (so it can call vault.manage())
  const tx3 = m.call(rolesAuthority, "setUserRole", [manager, ROLES.MANAGER, true], {
    id: "setUserRole_MANAGER_Manager",
    after: [tx2],
  });

  // Grant STRATEGIST_ROLE to admin so they can call manageVaultWithMerkleVerification
  m.call(rolesAuthority, "setUserRole", [adminAddress, ROLES.STRATEGIST, true], {
    id: "setUserRole_STRATEGIST_Admin",
    after: [tx3],
  });

  return { manager, vault };
});
