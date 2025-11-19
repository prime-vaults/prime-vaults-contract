import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import TellerModule from "./vault/Teller.js";

/**
 * Distributor Module
 * Deploys Distributor for reward distribution
 */
const DistributorModule = buildModule("DistributorModule", (m) => {
  const { vault, teller, primeRegistry, primeRBAC } = m.useModule(TellerModule);

  const distributor = m.contract("Distributor", [primeRBAC, vault], {
    after: [vault, primeRegistry],
  });

  // Connect distributor to teller
  m.call(teller, "setDistributor", [distributor], { id: "teller_setDistributor" });

  return { distributor, vault, teller, primeRegistry };
});

export default DistributorModule;
