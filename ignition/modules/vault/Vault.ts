import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Vault Module
 * Deploys BoringVault and RolesAuthority with initial permissions
 */
export default buildModule("VaultModule", (m) => {
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const decoder = m.contractAt("FullDecoderAndSanitizer", m.getParameter("DecoderAndSanitizerAddress"));

  // Deploy RolesAuthority for this vault
  const rolesAuthority = m.contract("RolesAuthority", [primeRegistry]);

  // Deploy BoringVault
  const vault = m.contract(
    "BoringVault",
    [primeRBAC, rolesAuthority, m.getParameter("name"), m.getParameter("symbol"), m.getParameter("stakingToken")],
    { after: [primeRegistry, rolesAuthority] },
  );
  m.call(primeRegistry, "registerVault", [vault], { id: "registerVault" });

  return { vault, rolesAuthority, primeRegistry, primeRBAC, decoder };
});
