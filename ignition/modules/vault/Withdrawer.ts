import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Withdrawer Module
 * Deploys DelayedWithdraw for time-delayed withdrawal functionality
 */
export default buildModule("WithdrawerModule", (m) => {
  const rolesAuthority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

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

  // Setup withdrawal with delay, normal fee, and expedited fee
  m.call(withdrawer, "setupWithdraw", [m.getParameter("withdrawDelayInSeconds"), m.getParameter("withdrawFee"), m.getParameter("expeditedWithdrawFee")], {
    after: [withdrawer],
  });

  // Set public capabilities for withdrawer user functions
  m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("cancelWithdraw()"), true], {
    id: "setPublicCapability_cancelWithdraw",
  });

  m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("requestWithdraw(uint96,bool)"), true], {
    id: "setPublicCapability_requestWithdraw",
  });

  m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("accelerateWithdraw()"), true], {
    id: "setPublicCapability_accelerateWithdraw",
  });

  m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("completeWithdraw(address)"), true], {
    id: "setPublicCapability_completeWithdraw",
  });

  m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("setAllowThirdPartyToComplete(bool)"), true], {
    id: "setPublicCapability_setAllowThirdPartyToComplete",
  });

  m.call(rolesAuthority, "setUserRole", [withdrawer, ROLES.BURNER, true], { id: "setUserRole_BURNER_Withdrawer" });

  return { withdrawer };
});
