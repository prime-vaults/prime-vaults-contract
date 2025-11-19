import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";

/**
 * Teller Module
 * Deploys TellerWithYieldStreaming for user deposits and withdrawals
 */
export default buildModule("TellerModule", (m) => {
  const { vault, accountant, primeRegistry, rolesAuthority, primeRBAC } = m.useModule(AccountantModule);

  // Deploy Teller
  const teller = m.contract("TellerWithYieldStreaming", [primeRBAC, vault, accountant], {
    after: [accountant, vault],
  });
  // Register teller and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerTeller", [teller], { id: "registerTeller" });
  const primeBufferHelper = m.contract("PrimeBufferHelper", [m.getParameter("PrimeStrategistAddress"), vault], {
    after: [teller],
  });

  m.call(teller, "allowBufferHelper", [primeBufferHelper], { id: "teller_allowBufferHelper" });
  m.call(teller, "setWithdrawBufferHelper", [primeBufferHelper], { id: "teller_setWithdrawBufferHelper" });
  m.call(vault, "setBeforeUpdateHook", [teller], { id: "vault_setBeforeUpdateHook" });

  return { teller, primeBufferHelper, accountant, vault, primeRegistry, rolesAuthority, primeRBAC };
});
