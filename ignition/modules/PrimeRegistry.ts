import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PrimeRegistryModule", (m) => {
  const primeRBAC = m.contract("PrimeRBAC", [], {
    after: [],
  });
  const primeRegistry = m.contract("PrimeRegistry", [primeRBAC], {
    after: [primeRBAC],
  });
  return { primeRegistry };
});
