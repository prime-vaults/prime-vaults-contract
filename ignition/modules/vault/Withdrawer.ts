import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Withdrawer Module - Deploy DelayedWithdraw with time-delayed withdrawals
 *
 * Sequential execution order:
 * 1. Deploy DelayedWithdraw contract
 * 2. Setup withdrawal parameters (delay, fees)
 * 3. Set public capabilities (user functions)
 * 4. Assign BURNER role to withdrawer
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
      m.getParameter("RolesAuthorityAddress"),
    ],
    {},
  );

  // Setup withdrawal parameters
  const tx1 = m.call(
    withdrawer,
    "setupWithdraw",
    [m.getParameter("withdrawDelayInSeconds"), m.getParameter("withdrawFee"), m.getParameter("expeditedWithdrawFee")],
    { id: "setup", after: [withdrawer] },
  );

  // Set public capabilities sequentially
  const tx2 = m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("cancelWithdraw()"), true], { id: "cap_cancel", after: [tx1] });

  const tx3 = m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("requestWithdraw(uint96,bool)"), true], {
    id: "cap_request",
    after: [tx2],
  });

  const tx4 = m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("accelerateWithdraw()"), true], {
    id: "cap_accelerate",
    after: [tx3],
  });

  const tx5 = m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("completeWithdraw(address,uint256)"), true], {
    id: "cap_complete",
    after: [tx4],
  });

  const tx6 = m.call(rolesAuthority, "setPublicCapability", [withdrawer, toFunctionSelector("setAllowThirdPartyToComplete(bool)"), true], {
    id: "cap_3rdparty",
    after: [tx5],
  });

  // Assign BURNER role
  m.call(rolesAuthority, "setUserRole", [withdrawer, ROLES.BURNER, true], {
    id: "role_burner",
    after: [tx6],
  });

  return { withdrawer };
});
