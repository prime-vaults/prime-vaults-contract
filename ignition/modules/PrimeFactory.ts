import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import WithdrawerModule from "./Withdrawer.js";

export default buildModule("PrimeFactoryModule", (m) => {
  const { accountant, primeRegistry, rolesAuthority, teller, vault, withdrawer } = m.useModule(WithdrawerModule);

  const ADMIN_ROLE = 1;
  const MANAGER_ROLE = 2;
  const MINTER_ROLE = 3;
  const BORING_VAULT_ROLE = 4;
  const UPDATE_EXCHANGE_RATE_ROLE = 3;
  const STRATEGIST_ROLE = 7;
  const BURNER_ROLE = 8;

  // Set user roles for accountant
  m.call(rolesAuthority, "setUserRole", [accountant, MINTER_ROLE, true], {
    id: "setUserRole_accountant_minter",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, ADMIN_ROLE, true], {
    id: "setUserRole_accountant_admin",
  });

  m.call(rolesAuthority, "setUserRole", [accountant, UPDATE_EXCHANGE_RATE_ROLE, true], {
    id: "setUserRole_accountant_updateExchangeRate",
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
