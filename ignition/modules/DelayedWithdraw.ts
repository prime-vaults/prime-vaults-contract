import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";
import VaultModule from "./Vault.js";

export default buildModule("DelayedWithdraw", (m) => {
  // Get parameters
  const owner = m.getParameter("adminAddress");
  const { vault } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);

  // Deploy DelayedWithdraw
  const delayedWithdraw = m.contract("DelayedWithdraw", [owner, vault, accountant, owner], {
    after: [vault, accountant],
  });
  return { delayedWithdraw };
});
