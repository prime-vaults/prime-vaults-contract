import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import AccountantModule from "./Accountant.js";

export default buildModule("TellerModule", (m) => {
  const { vault, accountant, ...rest } = m.useModule(AccountantModule);

  const MINTER_ROLE = 3;
  const BURNER_ROLE = 8;
  const MANAGER_ROLE = 2;

  const teller = m.contract(
    "TellerWithYieldStreaming",
    [rest.primeRegistry, vault, accountant, m.getParameter("tokenAddress"), m.getParameter("wrapNative")],
    {
      after: [accountant],
    },
  );

  m.call(teller, "setAuthority", [rest.rolesAuthority]);

  // Set role capabilities for deposit functions
  m.call(
    rest.rolesAuthority,
    "setRoleCapability",
    [MINTER_ROLE, teller, toFunctionSelector("deposit(address,uint256,uint256)"), true],
    { id: "setRoleCapability_deposit" },
  );

  m.call(
    rest.rolesAuthority,
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
    rest.rolesAuthority,
    "setRoleCapability",
    [BURNER_ROLE, teller, toFunctionSelector("withdraw(uint256,uint256,address)"), true],
    { id: "setRoleCapability_withdraw" },
  );

  // Set role capabilities for buffer helper functions
  m.call(
    rest.rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, teller, toFunctionSelector("setDepositBufferHelper(address)"), true],
    { id: "setRoleCapability_setDepositBufferHelper" },
  );

  m.call(
    rest.rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, teller, toFunctionSelector("setWithdrawBufferHelper(address)"), true],
    { id: "setRoleCapability_setWithdrawBufferHelper" },
  );

  m.call(
    rest.rolesAuthority,
    "setRoleCapability",
    [MANAGER_ROLE, teller, toFunctionSelector("allowBufferHelper(address)"), true],
    { id: "setRoleCapability_allowBufferHelper" },
  );

  // const primeBufferHelper = m.contract("PrimeBufferHelper", [m.getParameter("primeStrategist"), vault], {
  //   after: [teller],
  // });
  // m.call(vault, "setBeforeTransferHook", [teller]);
  // m.call(teller, "allowBufferHelper", [primeBufferHelper]);
  // m.call(teller, "setDepositBufferHelper", [primeBufferHelper]);
  // m.call(teller, "setWithdrawBufferHelper", [primeBufferHelper]);

  return { teller, accountant, vault, ...rest };
});
