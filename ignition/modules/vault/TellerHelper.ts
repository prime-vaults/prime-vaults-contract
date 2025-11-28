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

  const tx0 = m.call(teller, "allowBufferHelper", [primeBufferHelper]);
  const tx1 = m.call(teller, "setWithdrawBufferHelper", [primeBufferHelper], { after: [tx0] });
  m.call(vault, "setBeforeUpdateHook", [teller], { after: [tx1] });
  return { primeBufferHelper };
});
