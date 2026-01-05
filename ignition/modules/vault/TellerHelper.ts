import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Teller Module
 * Deploys TellerWithBuffer for user deposits and withdrawals
 */
export default buildModule("TellerHelper", (m) => {
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const teller = m.contractAt("TellerWithBuffer", m.getParameter("TellerAddress"));

  // Deploy PrimeBufferHelper
  const primeBufferHelper = m.contract("PrimeBufferHelper", [m.getParameter("PrimeStrategistAddress"), vault], {
    after: [teller],
  });

  const tx0 = m.call(teller, "allowBufferHelper", [primeBufferHelper]);
  const tx1 = m.call(teller, "setWithdrawBufferHelper", [primeBufferHelper], { after: [tx0] });
  const tx2 = m.call(teller, "setDepositBufferHelper", [primeBufferHelper], { after: [tx1] });
  // npx hardhat ignition wipe bepolia-usd TellerHelper#BoringVault.setBeforeUpdateHook
  m.call(vault, "setBeforeUpdateHook", [teller], { after: [tx2] });
  return { primeBufferHelper };
});
