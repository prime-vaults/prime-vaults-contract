import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import RolesAuthorityModule from "./RolesAuthority.js";
import VaultModule from "./Vault.js";

export default buildModule("AccountantModule", (m) => {
  const { rolesAuthority } = m.useModule(RolesAuthorityModule);
  const { vault } = m.useModule(VaultModule);

  const accountant = m.contract(
    "AccountantWithYieldStreaming",
    [
      m.getParameter("adminAddress"),
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
      after: [rolesAuthority, vault],
    },
  );
  m.call(accountant, "setAuthority", [rolesAuthority]);

  return { accountant, vault, rolesAuthority };
});
