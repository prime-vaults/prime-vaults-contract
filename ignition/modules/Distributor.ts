import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Distributor Module
 * Deploys Distributor for reward distribution
 */
const DistributorModule = buildModule("DistributorModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));
  const teller = m.contractAt("TellerWithYieldStreaming", m.getParameter("TellerAddress"));

  const distributor = m.contract("Distributor", [primeRBAC, vault], {
    after: [vault],
  });

  // Connect distributor to teller
  m.call(teller, "setDistributor", [distributor], { id: "teller_setDistributor" });
  return { distributor, vault, teller };
});

export default DistributorModule;
