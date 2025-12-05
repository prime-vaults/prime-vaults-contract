import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Accountant Module
 * Deploys AccountantProviders for exchange rate and fee management
 */
export default buildModule("AccountantModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const rolesAuthority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

  // Deploy Accountant
  const accountant = m.contract(
    "AccountantProviders",
    [primeRBAC, m.getParameter("BoringVaultAddress"), m.getParameter("adminAddress"), m.getParameter("platformFee")],
    { after: [] },
  );

  // Set role capabilities for Accountant functions
  m.call(rolesAuthority, "setRoleCapability", [ROLES.STRATEGIST, accountant, toFunctionSelector("updateExchangeRate()"), true], {
    id: "setRoleCapability_updateExchangeRate",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, ROLES.MINTER, true], { id: "setUserRole_MINTER_Accountant" });

  m.call(rolesAuthority, "setUserRole", [accountant, ROLES.ADMIN, true], { id: "setUserRole_ADMIN_Accountant" });

  m.call(rolesAuthority, "setUserRole", [accountant, ROLES.STRATEGIST, true], {
    id: "setUserRole_STRATEGIST_Accountant",
  });

  return { accountant, primeRBAC };
});
