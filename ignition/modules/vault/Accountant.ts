import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import VaultModule from "./Vault.js";

/**
 * Accountant Module
 * Deploys AccountantWithYieldStreaming for exchange rate and fee management
 */
export default buildModule("AccountantModule", (m) => {
  const { vault, primeRegistry, rolesAuthority, primeRBAC } = m.useModule(VaultModule);

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
  // Register accountant and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerAccountant", [accountant], { id: "registerAccountant" });

  return { accountant, vault, primeRegistry, rolesAuthority, primeRBAC };
});
