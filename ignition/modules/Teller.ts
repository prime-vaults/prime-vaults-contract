import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import AccountantModule from "./Accountant.js";

/**
 * Teller Module
 * Deploys TellerWithYieldStreaming for user deposits and withdrawals
 */
export default buildModule("TellerModule", (m) => {
  const { vault, accountant, primeRegistry, rolesAuthority } = m.useModule(AccountantModule);

  // Get role constants
  const MINTER_ROLE = m.getParameter("MINTER_ROLE");
  const BURNER_ROLE = m.getParameter("BURNER_ROLE");
  const MANAGER_ROLE = m.getParameter("MANAGER_ROLE");

  // Deploy Teller
  const teller = m.contract(
    "TellerWithYieldStreaming",
    [primeRegistry, vault, accountant, m.getParameter("stakingToken"), m.getParameter("wrapNative")],
    { after: [accountant] },
  );

  // Link teller to authority
  m.call(teller, "setAuthority", [rolesAuthority], { id: "teller_setAuthority" });

  // Set role capabilities for deposit functions
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, teller, toFunctionSelector("deposit(address,uint256,uint256)"), true],
    { id: "setRoleCapability_deposit" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [
      MINTER_ROLE,
      teller,
      toFunctionSelector("depositWithPermit(address,uint256,uint256,uint256,uint8,bytes32,bytes32)"),
      true,
    ],
    { id: "setRoleCapability_depositWithPermit" },
  );

  // Set role capability for withdraw function
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [BURNER_ROLE, teller, toFunctionSelector("withdraw(uint256,uint256,address)"), true],
    { id: "setRoleCapability_withdraw" },
  );

  // Set role capabilities for buffer helper management (future use)
  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, teller, toFunctionSelector("setDepositBufferHelper(address)"), true],
    { id: "setRoleCapability_setDepositBufferHelper" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, teller, toFunctionSelector("setWithdrawBufferHelper(address)"), true],
    { id: "setRoleCapability_setWithdrawBufferHelper" },
  );

  m.call(
    rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, teller, toFunctionSelector("allowBufferHelper(address)"), true],
    { id: "setRoleCapability_allowBufferHelper" },
  );

  return { teller, accountant, vault, primeRegistry, rolesAuthority };
});
