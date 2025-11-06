import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";
import VaultModule from "./Vault.js";

export default buildModule("TellerModule", (m) => {
  const { vault } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);

  const teller = m.contract(
    "TellerWithYieldStreaming",
    [m.getParameter("adminAddress"), vault, accountant, m.getParameter("tokenAddress"), m.getParameter("wrapNative")],
    {
      after: [accountant],
    },
  );

  m.call(vault, "setBeforeTransferHook", [vault]);
  return { teller, accountant, vault };
});
