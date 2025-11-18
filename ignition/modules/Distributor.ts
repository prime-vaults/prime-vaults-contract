import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";

const DistributorModule = buildModule("DistributorModule", (m) => {
  const { vault, primeRegistry } = m.useModule(AccountantModule);

  const distributor = m.contract("Distributor", [primeRegistry, vault]);
  return { distributor };
});

export default DistributorModule;
