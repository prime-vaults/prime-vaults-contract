import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Vault Module - Deploy BoringVault with RolesAuthority
 *
 * Sequential execution order:
 * 1. Deploy RolesAuthority (RBAC system)
 * 2. Deploy BoringVault (vault contract)
 * 3. Set role capabilities (MANAGER, MINTER, BURNER)
 * 4. Assign vault role
 */
export default buildModule("VaultModule", (m) => {
  const decoder = m.contractAt("FullDecoderAndSanitizer", m.getParameter("DecoderAndSanitizerAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));

  // Deploy RolesAuthority (owner = deployer)
  const rolesAuthority = m.contract("RolesAuthority", ["0x0000000000000000000000000000000000000000"]);

  // Deploy BoringVault
  const vault = m.contract("BoringVault", [primeRBAC, rolesAuthority, m.getParameter("name"), m.getParameter("symbol"), m.getParameter("stakingToken")], {
    after: [rolesAuthority],
  });

  // Set role capabilities sequentially
  const tx1 = m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, vault, toFunctionSelector("manage(address,bytes,uint256)"), true], {
    id: "cap_manage",
    after: [vault],
  });

  const tx2 = m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, vault, toFunctionSelector("bulkManage(address[],bytes[],uint256[])"), true], {
    id: "cap_bulk",
    after: [tx1],
  });

  const tx3 = m.call(rolesAuthority, "setRoleCapability", [ROLES.MINTER, vault, toFunctionSelector("enter(address,uint256,address,uint256)"), true], {
    id: "cap_enter",
    after: [tx2],
  });

  const tx4 = m.call(rolesAuthority, "setRoleCapability", [ROLES.BURNER, vault, toFunctionSelector("exit(address,uint256,address,uint256)"), true], {
    id: "cap_exit",
    after: [tx3],
  });

  // Assign vault role to vault contract itself
  m.call(rolesAuthority, "setUserRole", [vault, ROLES.BORING_VAULT, true], {
    id: "role_vault",
    after: [tx4],
  });

  return { vault, rolesAuthority, decoder };
});
