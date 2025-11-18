import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import VaultModule from "./Vault.js";

/**
 * Accountant Module
 * Deploys AccountantWithYieldStreaming for exchange rate and fee management
 */
export default buildModule("AccountantModule", (m) => {
  const { vault, primeRegistry, rolesAuthority, primeRBAC } = m.useModule(VaultModule);

  // Get role constants
  const MINTER_ROLE = m.getParameter("MINTER_ROLE");
  const STRATEGIST_ROLE = m.getParameter("STRATEGIST_ROLE");

  // Deploy Accountant
  const accountant = m.contract(
    "AccountantWithYieldStreaming",
    [
      primeRBAC,
      vault,
      m.getParameter("adminAddress"),
      m.getParameter("startingExchangeRate"),
      m.getParameter("allowedExchangeRateChangeUpper"),
      m.getParameter("allowedExchangeRateChangeLower"),
      m.getParameter("minimumUpdateDelayInSeconds"),
      m.getParameter("platformFee"),
      m.getParameter("performanceFee"),
    ],
    { after: [vault] },
  );

  // Link accountant to authority
  m.call(accountant, "setAuthority", [rolesAuthority], { id: "accountant_setAuthority" });

  // Set role capabilities for Accountant functions
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, accountant, toFunctionSelector("setFirstDepositTimestamp()"), true],
    { id: "setRoleCapability_setFirstDepositTimestamp" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [STRATEGIST_ROLE, accountant, toFunctionSelector("updateExchangeRate()"), true],
    { id: "setRoleCapability_updateExchangeRate" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, accountant, toFunctionSelector("updateCumulative()"), true],
    { id: "setRoleCapability_updateCumulative" },
  );

  return { accountant, vault, primeRegistry, rolesAuthority, primeRBAC };
});
