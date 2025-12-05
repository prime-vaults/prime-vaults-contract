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
  const tx1 = m.call(rolesAuthority, "setPublicCapability", [teller, toFunctionSelector("deposit(uint256,uint256,address)"), true], {
    id: "setPublicCapability_deposit",
    after: [teller],
  });

  // Set role capabilities for Teller functions
  const tx2 = m.call(rolesAuthority, "setRoleCapability", [ROLES.BURNER, teller, toFunctionSelector("withdraw(uint256,uint256,address)"), true], {
    id: "setRoleCapability_withdraw",
    after: [tx1],
  });

  const tx3 = m.call(rolesAuthority, "setRoleCapability", [ROLES.BURNER, teller, toFunctionSelector("bulkWithdraw(uint256,uint256,address)"), true], {
    id: "setRoleCapability_bulkWithdraw",
    after: [tx2],
  });

  // Set role capabilities for buffer helper management
  const tx4 = m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, teller, toFunctionSelector("setDepositBufferHelper(address)"), true], {
    id: "setRoleCapability_setDepositBufferHelper",
    after: [tx3],
  });

  const tx5 = m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, teller, toFunctionSelector("setWithdrawBufferHelper(address)"), true], {
    id: "setRoleCapability_setWithdrawBufferHelper",
    after: [tx4],
  });

  const tx6 = m.call(rolesAuthority, "setRoleCapability", [ROLES.MANAGER, teller, toFunctionSelector("allowBufferHelper(address)"), true], {
    id: "setRoleCapability_allowBufferHelper",
    after: [tx5],
  });

  const tx7 = m.call(rolesAuthority, "setUserRole", [teller, ROLES.MINTER, true], {
    id: "setUserRole_MINTER_Teller",
    after: [tx6],
  });

  const tx8 = m.call(rolesAuthority, "setUserRole", [teller, ROLES.BURNER, true], {
    id: "setUserRole_BURNER_Teller",
    after: [tx7],
  });

  const tx9 = m.call(rolesAuthority, "setUserRole", [teller, ROLES.MANAGER, true], {
    id: "setUserRole_MANAGER_Teller",
    after: [tx8],
  });

  // npx hardhat ignition wipe bepolia-usd TellerModule#setUserRole_STRATEGIST_Teller
  m.call(rolesAuthority, "setUserRole", [teller, ROLES.STRATEGIST, true], {
    id: "setUserRole_STRATEGIST_Teller",
    after: [tx9],
  });

  return { teller, accountant, vault, primeRBAC };
});
