import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Accountant Module
 * Deploys AccountantProviders for exchange rate and fee management
 */
export default buildModule("AccountantModule", (m) => {
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));

  // Deploy Accountant
  const accountant = m.contract(
    "AccountantProviders",
    [primeRBAC, m.getParameter("BoringVaultAddress"), m.getParameter("adminAddress"), m.getParameter("platformFee")],
    { after: [] },
  );
  // Register accountant and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerAccountant", [accountant], { id: "registerAccountant" });

  return { accountant, primeRegistry, primeRBAC };
});
