import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import PrimeRegistryModule from "../PrimeRegistry.js";

/**
 * Vault Module
 * Deploys BoringVault and RolesAuthority with initial permissions
 */
export default buildModule("VaultModule", (m) => {
  const { primeRegistry, primeRBAC } = m.useModule(PrimeRegistryModule);

  // Deploy RolesAuthority for this vault
  const rolesAuthority = m.contract("RolesAuthority", [primeRegistry]);

  // Deploy BoringVault
  const vault = m.contract(
    "BoringVault",
    [primeRBAC, rolesAuthority, m.getParameter("name"), m.getParameter("symbol"), m.getParameter("stakingToken")],
    { after: [primeRegistry, rolesAuthority] },
  );
  m.call(primeRegistry, "registerVault", [vault], { id: "registerVault" });

  return { vault, rolesAuthority, primeRegistry, primeRBAC };
});
