import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Accountant Module
 * Deploys AccountantWithYieldStreaming for exchange rate and fee management
 */
export default buildModule("AccountantModule", (m) => {
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));

  // Deploy Accountant
  const accountant = m.contract(
    "AccountantWithYieldStreaming",
    [
      primeRBAC,
      m.getParameter("BoringVaultAddress"),
      m.getParameter("adminAddress"),
      m.getParameter("startingExchangeRate"),
      m.getParameter("allowedExchangeRateChangeUpper"),
      m.getParameter("allowedExchangeRateChangeLower"),
      m.getParameter("minimumUpdateDelayInSeconds"),
      m.getParameter("platformFee"),
      m.getParameter("performanceFee"),
    ],
    { after: [] },
  );
  // Register accountant and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerAccountant", [accountant], { id: "registerAccountant" });

  return { accountant, primeRegistry, primeRBAC };
});
