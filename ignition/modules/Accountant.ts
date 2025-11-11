import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import VaultModule from "./Vault.js";

export default buildModule("AccountantModule", (m) => {
  const { vault, primeRegistry, rolesAuthority } = m.useModule(VaultModule);

  const MINTER_ROLE = 3;
  const ADMIN_ROLE = 1;
  const UPDATE_EXCHANGE_RATE_ROLE = 3;
  const BORING_VAULT_ROLE = 4;
  const STRATEGIST_ROLE = 7;

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
  m.call(rolesAuthority, "setRoleCapability", [ADMIN_ROLE, accountant, toFunctionSelector("pause()"), true], {
    id: "setRoleCapability_pause",
  });

  m.call(rolesAuthority, "setRoleCapability", [ADMIN_ROLE, accountant, toFunctionSelector("unpause()"), true], {
    id: "setRoleCapability_unpause",
  });

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [ADMIN_ROLE, accountant, toFunctionSelector("updateDelay(uint24)"), true],
    { id: "setRoleCapability_updateDelay" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [ADMIN_ROLE, accountant, toFunctionSelector("updateUpper(uint16)"), true],
    { id: "setRoleCapability_updateUpper" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [ADMIN_ROLE, accountant, toFunctionSelector("updateLower(uint16)"), true],
    { id: "setRoleCapability_updateLower" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [ADMIN_ROLE, accountant, toFunctionSelector("updatePlatformFee(uint16)"), true],
    { id: "setRoleCapability_updatePlatformFee" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [ADMIN_ROLE, accountant, toFunctionSelector("updatePayoutAddress(address)"), true],
    { id: "setRoleCapability_updatePayoutAddress" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [UPDATE_EXCHANGE_RATE_ROLE, accountant, toFunctionSelector("updateExchangeRate(uint96)"), true],
    { id: "setRoleCapability_updateExchangeRate_uint96" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [BORING_VAULT_ROLE, accountant, toFunctionSelector("claimFees(address)"), true],
    { id: "setRoleCapability_claimFees" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [STRATEGIST_ROLE, accountant, toFunctionSelector("vestYield(uint256)"), true],
    { id: "setRoleCapability_vestYield" },
  );

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
