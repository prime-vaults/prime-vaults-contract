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

  // Link withdrawer to authority
  m.call(withdrawer, "setAuthority", [rolesAuthority], { id: "withdrawer_setAuthority" });

  // Register withdrawer and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerWithdrawer", [withdrawer], {
    id: "registerWithdrawer",
  });

  // Configure withdrawer
  m.call(withdrawer, "setPullFundsFromVault", [true], { id: "withdrawer_setPullFundsFromVault" });

  m.call(
    withdrawer,
    "setupWithdrawAsset",
    [m.getParameter("stakingToken"), m.getParameter("withdrawDelayInSeconds"), m.getParameter("withdrawFee")],
    { id: "withdrawer_setupWithdrawAsset" },
  );

  return { withdrawer, vault, accountant, teller, primeRegistry, rolesAuthority, primeRBAC };
});
