import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import PrimeRegistryModule from "./PrimeRegistry.js";

/**
 * Vault Module
 * Deploys BoringVault and RolesAuthority with initial permissions
 */
export default buildModule("VaultModule", (m) => {
  const { primeRegistry } = m.useModule(PrimeRegistryModule);

  // Get role constants
  const MANAGER_ROLE = m.getParameter("MANAGER_ROLE");
  const MINTER_ROLE = m.getParameter("MINTER_ROLE");
  const BURNER_ROLE = m.getParameter("BURNER_ROLE");

  // Deploy RolesAuthority for this vault
  const rolesAuthority = m.contract("RolesAuthority", [m.getParameter("adminAddress")]);

  // Deploy BoringVault
  const vault = m.contract(
    "BoringVault",
    [primeRegistry, m.getParameter("name"), m.getParameter("symbol"), m.getParameter("stakingToken")],
    { after: [primeRegistry, rolesAuthority] },
  );

  // Link vault to authority
  m.call(vault, "setAuthority", [rolesAuthority], { id: "vault_setAuthority" });

  // Allow vault to receive ETH (fallback function)
  m.call(rolesAuthority, "setPublicCapability", [vault, "0x00000000", true], {
    id: "setPublicCapability_receiveETH",
  });

  // Set role capabilities for vault management
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, vault, toFunctionSelector("manage(address,bytes,uint256)"), true],
    { id: "setRoleCapability_manage_single" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, vault, toFunctionSelector("manage(address[],bytes[],uint256[])"), true],
    { id: "setRoleCapability_manage_multi" },
  );

  // Set role capabilities for minting and burning shares
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, vault, toFunctionSelector("enter(address,address,uint256,address,uint256)"), true],
    { id: "setRoleCapability_enter" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [BURNER_ROLE, vault, toFunctionSelector("exit(address,address,uint256,address,uint256)"), true],
    { id: "setRoleCapability_exit" },
  );

  return { vault, rolesAuthority, primeRegistry };
});
