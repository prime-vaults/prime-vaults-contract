import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

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

  // Set public capabilities for withdrawer user functions
  m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("cancelWithdraw(address)"), true], {
    id: "setPublicCapability_cancelWithdraw",
  });

  m.call(
    rolesAuthority,
    "setPublicCapability",
    [withdrawer, toFunctionSelector("requestWithdraw(address,uint96,bool)"), true],
    { id: "setPublicCapability_requestWithdraw" },
  );

  m.call(
    rolesAuthority,
    "setPublicCapability",
    [withdrawer, toFunctionSelector("completeWithdraw(address,address)"), true],
    { id: "setPublicCapability_completeWithdraw" },
  );

  m.call(
    rolesAuthority,
    "setPublicCapability",
    [withdrawer, toFunctionSelector("setAllowThirdPartyToComplete(address,bool)"), true],
    { id: "setPublicCapability_setAllowThirdPartyToComplete" },
  );

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
