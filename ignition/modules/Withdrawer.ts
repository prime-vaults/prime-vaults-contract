import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import TellerModule from "./Teller.js";

/**
 * Withdrawer Module
 * Deploys DelayedWithdraw for time-delayed withdrawal functionality
 */
export default buildModule("WithdrawerModule", (m) => {
  const { vault, accountant, teller, primeRegistry, rolesAuthority, primeRBAC } = m.useModule(TellerModule);

  // Deploy DelayedWithdraw
  const withdrawer = m.contract(
    "DelayedWithdraw",
    [primeRBAC, vault, accountant, teller, m.getParameter("adminAddress")],
    { after: [teller] },
  );

  // Register withdrawer and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerWithdrawer", [withdrawer], {
    id: "registerWithdrawer",
  });

  // Setup withdrawal with delay and fee (no need to pass asset, it's derived from vault)
  m.call(withdrawer, "setupWithdraw", [m.getParameter("withdrawDelayInSeconds"), m.getParameter("withdrawFee")], {
    id: "withdrawer_setupWithdraw",
  });

  return { withdrawer, vault, accountant, teller, primeRegistry, rolesAuthority, primeRBAC };
});
