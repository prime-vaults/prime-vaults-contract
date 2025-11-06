import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import PrimeVaultFactory from "./PrimeVaultFactory.js";

export default buildModule("RolesAuthorityModule", (m) => {
  const { primeVaultFactory } = m.useModule(PrimeVaultFactory);
  const rolesAuthority = m.contract("RolesAuthority", [primeVaultFactory], {
    after: [primeVaultFactory],
  });

  return { rolesAuthority, primeVaultFactory };
});
