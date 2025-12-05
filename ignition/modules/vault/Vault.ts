import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Vault Module
 * Deploys BoringVault and RolesAuthority with initial permissions
 */
export default buildModule("VaultModule", (m) => {
  const decoder = m.contractAt("FullDecoderAndSanitizer", m.getParameter("DecoderAndSanitizerAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));

  // Deploy RolesAuthority for this vault
  // Pass address(0) as authority because PrimeRegistry is not an Authority and we want deployer to be owner
  const rolesAuthority = m.contract("RolesAuthority", ["0x0000000000000000000000000000000000000000"]);

  // Deploy BoringVault
  const vault = m.contract("BoringVault", [primeRBAC, rolesAuthority, m.getParameter("name"), m.getParameter("symbol"), m.getParameter("stakingToken")], {
    after: [rolesAuthority],
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, vault, toFunctionSelector("manage(address,bytes,uint256)"), true], {
    id: "setRoleCapability_manage",
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, vault, toFunctionSelector("bulkManage(address[],bytes[],uint256[])"), true], {
    id: "setRoleCapability_bulkManage",
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.MINTER, vault, toFunctionSelector("enter(address,uint256,address,uint256)"), true], {
    id: "setRoleCapability_enter",
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.BURNER, vault, toFunctionSelector("exit(address,uint256,address,uint256)"), true], {
    id: "setRoleCapability_exit",
  });

  m.call(rolesAuthority, "setUserRole", [vault, ROLES.BORING_VAULT, true], { id: "setUserRole_BORING_VAULT" });

  return { vault, rolesAuthority, decoder };
});
