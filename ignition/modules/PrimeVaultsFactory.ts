import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";
import TellerModule from "./Teller.js";
import VaultModule from "./Vault.js";
import DelayedWithdrawModule from "./Withdrawer.js";

export default buildModule("PrimeVaultsFactoryModule", (m) => {
  const { vault } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);
  const { teller } = m.useModule(TellerModule);
  const { withdrawer } = m.useModule(DelayedWithdrawModule);

  const primeVaultFactory = m.contract("PrimeVaultFactory", [], {
    after: [vault, accountant, teller, withdrawer],
  });

  const rolesAuthority = m.contract("RolesAuthority", [primeVaultFactory], {
    after: [vault, accountant, teller, withdrawer, primeVaultFactory],
  });

  m.call(accountant, "setAuthority", [rolesAuthority]);
  m.call(teller, "setAuthority", [rolesAuthority]);
  m.call(vault, "setAuthority", [rolesAuthority]);
  m.call(withdrawer, "setAuthority", [rolesAuthority]);
  m.call(primeVaultFactory, "setup", [rolesAuthority, vault, accountant, teller, withdrawer]);

  return { primeVaultFactory, vault, accountant, teller, withdrawer, rolesAuthority };
});
