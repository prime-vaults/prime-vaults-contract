import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Teller Module
 * Deploys TellerWithYieldStreaming for user deposits and withdrawals
 */
export default buildModule("TellerModule", (m) => {
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const accountant = m.contractAt("AccountantWithYieldStreaming", m.getParameter("AccountantAddress"));

  // Deploy Teller
  const teller = m.contract("TellerWithYieldStreaming", [primeRBAC, vault, accountant], {
    after: [accountant],
  });
  m.call(primeRegistry, "registerTeller", [teller], { id: "registerTeller" });

  // Deploy PrimeBufferHelper
  const primeBufferHelper = m.contract("PrimeBufferHelper", [m.getParameter("PrimeStrategistAddress"), vault], {
    after: [teller],
  });
  // m.call(teller, "allowBufferHelper", [primeBufferHelper], { id: "teller_allowBufferHelper" });
  // m.call(teller, "setWithdrawBufferHelper", [primeBufferHelper], { id: "teller_setWithdrawBufferHelper" });
  // m.call(vault, "setBeforeUpdateHook", [teller], { id: "vault_setBeforeUpdateHook" });

  return { teller, primeBufferHelper, accountant, vault, primeRegistry, primeRBAC };
});
