import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../../constants.js";

/**
 * Teller Module
 * Deploys TellerWithBuffer for user deposits and withdrawals
 */
export default buildModule("TellerModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const accountant = m.contractAt("AccountantProviders", m.getParameter("AccountantAddress"));
  const rolesAuthority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

  // Deploy Teller
  const teller = m.contract("TellerWithBuffer", [primeRBAC, vault, accountant], {
    after: [accountant],
  });

  // Set public capability for deposit
  m.call(rolesAuthority, "setPublicCapability", [teller, toFunctionSelector("deposit(uint256,uint256,address)"), true], { id: "setPublicCapability_deposit" });

  // Set role capabilities for Teller functions
  m.call(rolesAuthority, "setRoleCapability", [ROLES.BURNER, teller, toFunctionSelector("withdraw(uint256,uint256,address)"), true], {
    id: "setRoleCapability_withdraw",
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.BURNER, teller, toFunctionSelector("bulkWithdraw(uint256,uint256,address)"), true], {
    id: "setRoleCapability_bulkWithdraw",
  });

  // Set role capabilities for buffer helper management
  m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, teller, toFunctionSelector("setDepositBufferHelper(address)"), true], {
    id: "setRoleCapability_setDepositBufferHelper",
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, teller, toFunctionSelector("setWithdrawBufferHelper(address)"), true], {
    id: "setRoleCapability_setWithdrawBufferHelper",
  });

  m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, teller, toFunctionSelector("allowBufferHelper(address)"), true], {
    id: "setRoleCapability_allowBufferHelper",
  });

  m.call(rolesAuthority, "setUserRole", [teller, ROLES.MINTER, true], { id: "setUserRole_MINTER_Teller" });

  m.call(rolesAuthority, "setUserRole", [teller, ROLES.BURNER, true], { id: "setUserRole_BURNER_Teller" });

  m.call(rolesAuthority, "setUserRole", [teller, ROLES.MANAGER, true], { id: "setUserRole_MANAGER_Teller" });

  m.call(rolesAuthority, "setUserRole", [teller, ROLES.STRATEGIST, true], { id: "setUserRole_STRATEGIST_Teller" });

  return { teller, accountant, vault, primeRBAC };
});
