import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Accountant Module - Deploy AccountantProviders with role configuration
 *
 * Sequential execution order:
 * 1. Deploy AccountantProviders
 * 2. Grant STRATEGIST role capability for updateExchangeRate()
 * 3. Assign roles to Accountant contract (MINTER, ADMIN, STRATEGIST)
 */
export default buildModule("AccountantModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const rolesAuthority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

  // Deploy AccountantProviders
  const accountant = m.contract(
    "AccountantProviders",
    [primeRBAC, m.getParameter("BoringVaultAddress"), m.getParameter("adminAddress"), m.getParameter("platformFee")],
    { after: [] },
  );

  // Set role capabilities and assignments sequentially
  const tx1 = m.call(rolesAuthority, "setRoleCapability", [ROLES.STRATEGIST, accountant, toFunctionSelector("updateExchangeRate()"), true], {
    id: "cap_update",
    after: [accountant],
  });

  const tx2 = m.call(rolesAuthority, "setUserRole", [accountant, ROLES.MINTER, true], {
    id: "role_minter",
    after: [tx1],
  });

  const tx3 = m.call(rolesAuthority, "setUserRole", [accountant, ROLES.ADMIN, true], {
    id: "role_admin",
    after: [tx2],
  });

  m.call(rolesAuthority, "setUserRole", [accountant, ROLES.STRATEGIST, true], {
    id: "role_strategist",
    after: [tx3],
  });

  return { accountant, primeRBAC };
});
