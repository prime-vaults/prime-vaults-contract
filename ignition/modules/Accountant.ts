import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import VaultModule from "./Vault.js";

export default buildModule("AccountantModule", (m) => {
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
      after: [vault],
    },
  );
  return { accountant, vault };
});
