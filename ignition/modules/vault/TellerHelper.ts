import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Teller Module
 * Deploys TellerWithYieldStreaming for user deposits and withdrawals
 */
export default buildModule("TellerHelper", (m) => {
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const teller = m.contractAt("TellerWithYieldStreaming", m.getParameter("TellerAddress"));

  // Deploy PrimeBufferHelper
  const primeBufferHelper = m.contract("PrimeBufferHelper", [m.getParameter("PrimeStrategistAddress"), vault], {
    after: [teller],
  });
  m.call(teller, "allowBufferHelper", [primeBufferHelper], { id: "teller_allowBufferHelper" });
  m.call(teller, "setWithdrawBufferHelper", [primeBufferHelper], { id: "teller_setWithdrawBufferHelper" });
  m.call(vault, "setBeforeUpdateHook", [teller], { id: "vault_setBeforeUpdateHook" });

  return { primeBufferHelper };
});
