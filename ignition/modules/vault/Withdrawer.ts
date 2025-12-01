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
  const tx1 = m.call(primeRegistry, "registerWithdrawer", [withdrawer]);

  // Setup withdrawal with delay, normal fee, and expedited fee
  m.call(
    withdrawer,
    "setupWithdraw",
    [
      m.getParameter("withdrawDelayInSeconds"),
      m.getParameter("withdrawFee"),
      m.getParameter("expeditedWithdrawFee"),
    ],
    {
      after: [tx1],
    },
  );

  return { withdrawer };
});
