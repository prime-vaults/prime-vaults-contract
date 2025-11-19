import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Manager Module
 * Deploys ManagerWithMerkleVerification for secure strategy execution
 */
export default buildModule("ManagerModule", (m) => {
  const adminAddress = m.getParameter("adminAddress");
  const primeRegistry = m.contractAt("PrimeRegistry", m.getParameter("PrimeRegistryAddress"));
  const vault = m.contractAt("BoringVault", m.getParameter("BoringVaultAddress"));

  // Deploy Manager
  const manager = m.contract("ManagerWithMerkleVerification", [m.getParameter("PrimeRBAC"), vault]);

  m.call(manager, "setManageRoot", [adminAddress, m.getParameter("manageRoot")]);
  m.call(primeRegistry, "registerManager", [manager], { id: "registerManager" });

  // Grant STRATEGIST_ROLE to admin so they can call manageVaultWithMerkleVerification
  m.call(primeRegistry, "grantStrategistRole", [adminAddress, vault], { id: "grant_admin_strategist_role" });

  return { manager, vault };
});
