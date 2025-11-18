import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import TellerModule from "./Teller.js";

const DistributorModule = buildModule("DistributorModule", (m) => {
  const { vault, teller, primeRegistry, rolesAuthority } = m.useModule(TellerModule);

  const distributor = m.contract("Distributor", [primeRegistry, vault], {
    after: [vault, primeRegistry],
  });

  // Link distributor to authority
  m.call(distributor, "setAuthority", [rolesAuthority], { id: "distributor_setAuthority" });

  // Connect distributor to teller
  m.call(teller, "setDistributor", [distributor], { id: "teller_setDistributor" });

  return { distributor, vault, teller, primeRegistry, rolesAuthority };
});

export default DistributorModule;
