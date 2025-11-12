import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import ManagerModule from "./Manager.js";
import WithdrawerModule from "./Withdrawer.js";

/**
 * Prime Vault Factory Module
 * Main deployment module that combines all components and sets up roles
 */
export default buildModule("PrimeVaultModule", (m) => {
  // Import all sub-modules
  const { withdrawer, vault, accountant, teller, primeRegistry, rolesAuthority } = m.useModule(WithdrawerModule);
  const { manager } = m.useModule(ManagerModule);

  // Get role constants
  const ADMIN_ROLE = m.getParameter("ADMIN_ROLE");
  const MANAGER_ROLE = m.getParameter("MANAGER_ROLE");
  const MINTER_ROLE = m.getParameter("MINTER_ROLE");
  const BORING_VAULT_ROLE = m.getParameter("BORING_VAULT_ROLE");
  const STRATEGIST_ROLE = m.getParameter("STRATEGIST_ROLE");
  const BURNER_ROLE = m.getParameter("BURNER_ROLE");

  // Assign roles to Accountant
  m.call(rolesAuthority, "setUserRole", [accountant, MINTER_ROLE, true], {
    id: "setUserRole_accountant_minter",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, ADMIN_ROLE, true], {
    id: "setUserRole_accountant_admin",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, STRATEGIST_ROLE, true], {
    id: "setUserRole_accountant_strategist",
  });

  // Assign role to Vault
  m.call(rolesAuthority, "setUserRole", [vault, BORING_VAULT_ROLE, true], {
    id: "setUserRole_vault_boringVault",
  });

  // Assign roles to Teller
  m.call(rolesAuthority, "setUserRole", [teller, MINTER_ROLE, true], {
    id: "setUserRole_teller_minter",
  });

  m.call(rolesAuthority, "setUserRole", [teller, BURNER_ROLE, true], {
    id: "setUserRole_teller_burner",
  });

  m.call(rolesAuthority, "setUserRole", [teller, MANAGER_ROLE, true], {
    id: "setUserRole_teller_manager",
  });

  m.call(rolesAuthority, "setUserRole", [teller, STRATEGIST_ROLE, true], {
    id: "setUserRole_teller_strategist",
  });

  // Assign role to Withdrawer
  m.call(rolesAuthority, "setUserRole", [withdrawer, BURNER_ROLE, true], {
    id: "setUserRole_withdrawer_burner",
  });

  return {
    vault,
    accountant,
    teller,
    withdrawer,
    manager,
    primeRegistry,
    rolesAuthority,
  };
});
