import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import TellerModule from "./Teller.js";

/**
 * Distributor Module
 * Deploys Distributor for reward distribution
 */
const DistributorModule = buildModule("DistributorModule", (m) => {
  const { vault, teller, primeRegistry, rolesAuthority, primeRBAC } = m.useModule(TellerModule);

  const distributor = m.contract("Distributor", [primeRBAC, vault], {
    after: [vault, primeRegistry],
  });

  // Link distributor to authority
  m.call(distributor, "setAuthority", [rolesAuthority], { id: "distributor_setAuthority" });

  // Connect distributor to teller
  m.call(teller, "setDistributor", [distributor], { id: "teller_setDistributor" });

  return { distributor, vault, teller, primeRegistry, rolesAuthority };
});

export default DistributorModule;
