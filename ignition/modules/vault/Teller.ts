import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Teller Module
 * Deploys TellerWithBuffer for user deposits and withdrawals
 */
export default buildModule("TellerModule", (m) => {
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const accountant = m.contractAt("AccountantProviders", m.getParameter("AccountantAddress"));

  // Deploy Teller
  const teller = m.contract("TellerWithBuffer", [primeRBAC, vault, accountant], {
    after: [accountant],
  });
  m.call(primeRegistry, "registerTeller", [teller], { id: "registerTeller" });

  return { teller, accountant, vault, primeRegistry, primeRBAC };
});
