import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Withdrawer Module
 * Deploys DelayedWithdraw for time-delayed withdrawal functionality
 */
export default buildModule("WithdrawerModule", (m) => {
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));

  // Deploy DelayedWithdraw
  const withdrawer = m.contract(
    "DelayedWithdraw",
    [
      m.getParameter("PrimeRBAC"),
      m.getParameter("BoringVaultAddress"),
      m.getParameter("AccountantAddress"),
      m.getParameter("TellerAddress"),
      m.getParameter("RolesAuthorityAddress"), // Use payout address, not admin
    ],
    {},
  );

  // Register withdrawer and setup all permissions via PrimeRegistry
  m.call(primeRegistry, "registerWithdrawer", [withdrawer], {
    id: "registerWithdrawer",
  });

  // Setup withdrawal with delay and fee (no need to pass asset, it's derived from vault)
  m.call(withdrawer, "setupWithdraw", [m.getParameter("withdrawDelayInSeconds"), m.getParameter("withdrawFee")], {
    id: "withdrawer_setupWithdraw",
  });

  return { withdrawer };
});
