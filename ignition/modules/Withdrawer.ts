import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import TellerModule from "./Teller.js";

export default buildModule("WithdrawerModule", (m) => {
  // Get parameters
  const owner = m.getParameter("adminAddress");
  const { vault, accountant, teller, primeRegistry, rolesAuthority } = m.useModule(TellerModule);

  // Deploy DelayedWithdraw
  const withdrawer = m.contract("DelayedWithdraw", [primeRegistry, vault, accountant, teller, owner], {
    after: [teller],
  });

  m.call(withdrawer, "setAuthority", [rolesAuthority]);

  // Set public capabilities for withdrawer functions
  // These functions have requiresAuth modifier, so we set them as public capabilities
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

  // Setup withdrawer
  m.call(withdrawer, "setPullFundsFromVault", [true]);
  m.call(withdrawer, "setupWithdrawAsset", [
    m.getParameter("tokenAddress"),
    m.getParameter("withdrawDelayInSeconds"),
    m.getParameter("withdrawFee"),
  ]);

  return { withdrawer, vault, accountant, teller, primeRegistry, rolesAuthority };
});
