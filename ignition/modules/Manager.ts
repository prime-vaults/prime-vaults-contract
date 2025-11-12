import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import VaultModule from "./Vault.js";

const ManagerModule = buildModule("ManagerModule", (m) => {
  // Get dependencies
  const vault = m.useModule(VaultModule);
  const boringVault = vault.vault;
  const rolesAuthority = vault.rolesAuthority;

  // Get parameters
  const adminAddress = m.getParameter("adminAddress");
  const MANAGER_ROLE = m.getParameter("MANAGER_ROLE");
  const STRATEGIST_ROLE = m.getParameter("STRATEGIST_ROLE");

  // Deploy ManagerWithMerkleVerification
  const manager = m.contract("ManagerWithMerkleVerification", [vault.primeRegistry, boringVault]);

  // Set authority for manager
  m.call(manager, "setAuthority", [rolesAuthority]);

  // Setup role capabilities for Manager
  // STRATEGIST_ROLE can call manageVaultWithMerkleVerification
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [
      STRATEGIST_ROLE,
      manager,
      toFunctionSelector("manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])"),
      true,
    ],
    {
      id: "setup_manager_manageVault_strategist",
    },
  );

  // Grant MANAGER_ROLE to the manager contract so it can call vault.manage()
  m.call(rolesAuthority, "setUserRole", [manager, MANAGER_ROLE, true], {
    id: "grant_manager_role_to_manager",
  });

  // Grant STRATEGIST_ROLE to admin (for testing/setup)
  m.call(rolesAuthority, "setUserRole", [adminAddress, STRATEGIST_ROLE, true], {
    id: "grant_strategist_role_to_admin",
  });

  return { manager, boringVault, rolesAuthority };
});

export default ManagerModule;
