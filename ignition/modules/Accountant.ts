import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import VaultModule from "./Vault.js";

export default buildModule("AccountantModule", (m) => {
  const { vault, primeRegistry, rolesAuthority } = m.useModule(VaultModule);

  const MINTER_ROLE = m.getParameter("MINTER_ROLE");
  const STRATEGIST_ROLE = m.getParameter("STRATEGIST_ROLE");

  const accountant = m.contract(
    "AccountantWithYieldStreaming",
    [
      primeRegistry,
      vault,
      m.getParameter("adminAddress"),
      m.getParameter("startingExchangeRate"),
      m.getParameter("tokenAddress"),
      m.getParameter("allowedExchangeRateChangeUpper"),
      m.getParameter("allowedExchangeRateChangeLower"),
      m.getParameter("minimumUpdateDelayInSeconds"),
      m.getParameter("platformFee"),
      m.getParameter("performanceFee"),
    ],
    {
      after: [vault],
    },
  );

  m.call(accountant, "setAuthority", [rolesAuthority]);

  // Set role capabilities for AccountantWithYieldStreaming functions
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, accountant, toFunctionSelector("setFirstDepositTimestamp()"), true],
    { id: "setRoleCapability_setFirstDepositTimestamp" },
  );

  // Set role capabilities for AccountantWithRateProviders functions
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [STRATEGIST_ROLE, accountant, toFunctionSelector("updateExchangeRate()"), true],
    { id: "setRoleCapability_updateExchangeRate" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, accountant, toFunctionSelector("updateCumulative()"), true],
    { id: "setRoleCapability_updateCumulative" },
  );

  return { accountant, vault, primeRegistry, rolesAuthority };
});
