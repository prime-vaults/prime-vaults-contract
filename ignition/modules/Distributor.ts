import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Distributor Module
 * Deploys Distributor for reward distribution
 */
const DistributorModule = buildModule("DistributorModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const teller = m.contractAt("TellerWithBuffer", m.getParameter("TellerAddress"));

  const distributor = m.contract("Distributor", [primeRBAC, teller]);

  // Connect distributor to teller
  m.call(teller, "setDistributor", [distributor]);
  return { distributor, teller };
});

export default DistributorModule;
