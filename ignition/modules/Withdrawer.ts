import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";
import VaultModule from "./Vault.js";

export default buildModule("WithdrawerModule", (m) => {
  // Get parameters
  const owner = m.getParameter("adminAddress");
  const { vault } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);

  // Deploy DelayedWithdraw
  const withdrawer = m.contract("DelayedWithdraw", [owner, vault, accountant, owner], {
    after: [vault, accountant],
  });
  m.call(withdrawer, "setPullFundsFromVault", [true]);
  m.call(withdrawer, "setupWithdrawAsset", [
    m.getParameter("tokenAddress"),
    m.getParameter("withdrawDelayInSeconds"),
    m.getParameter("completionWindowInSeconds"),
    m.getParameter("withdrawFee"),
  ]);

  return { withdrawer };
});
