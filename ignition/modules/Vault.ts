import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import PrimeRegistry from "./PrimeRegistry.js";

export default buildModule("VaultModule", (m) => {
  const { primeRegistry } = m.useModule(PrimeRegistry);

  const MANAGER_ROLE = 2;
  const MINTER_ROLE = 3;
  const BURNER_ROLE = 8;

  const rolesAuthority = m.contract("RolesAuthority", [m.getParameter("adminAddress")], {
    after: [],
  });

  const vault = m.contract(
    "BoringVault",
    [m.getParameter("adminAddress"), m.getParameter("name"), m.getParameter("symbol"), m.getParameter("decimals")],
    {
      after: [primeRegistry, rolesAuthority],
    },
  );

  m.call(vault, "setAuthority", [rolesAuthority]);

  // Allow the boring vault to receive ETH
  m.call(rolesAuthority, "setPublicCapability", [vault, "0x00000000", true], { id: "setPublicCapability_receiveETH" });

  // Set role capabilities for manage functions
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

  // Set role capabilities for enter and exit functions
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
