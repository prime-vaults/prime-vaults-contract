import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import WithdrawerModule from "./Withdrawer.js";

export default buildModule("PrimeFactoryModule", (m) => {
  const { accountant, primeRegistry, rolesAuthority, teller, vault, withdrawer } = m.useModule(WithdrawerModule);

  const ADMIN_ROLE = m.getParameter("ADMIN_ROLE");
  const MANAGER_ROLE = m.getParameter("MANAGER_ROLE");
  const MINTER_ROLE = m.getParameter("MINTER_ROLE");
  const BORING_VAULT_ROLE = m.getParameter("BORING_VAULT_ROLE");
  const STRATEGIST_ROLE = m.getParameter("STRATEGIST_ROLE");
  const BURNER_ROLE = m.getParameter("BURNER_ROLE");

  // Set user roles for accountant
  m.call(rolesAuthority, "setUserRole", [accountant, MINTER_ROLE, true], {
    id: "setUserRole_accountant_minter",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, ADMIN_ROLE, true], {
    id: "setUserRole_accountant_admin",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, STRATEGIST_ROLE, true], {
    id: "setUserRole_accountant_strategist",
  });

  // Set user role for vault
  m.call(rolesAuthority, "setUserRole", [vault, BORING_VAULT_ROLE, true], {
    id: "setUserRole_vault_boringVault",
  });

  // Set user roles for teller
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

  // Set user role for withdrawer
  m.call(rolesAuthority, "setUserRole", [withdrawer, BURNER_ROLE, true], {
    id: "setUserRole_withdrawer_burner",
  });

  return { primeRegistry, vault, accountant, teller, withdrawer, rolesAuthority };
});
