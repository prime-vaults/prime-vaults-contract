import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import AccountantModule from "./Accountant.js";
import DelayedWithdrawModule from "./DelayedWithdraw.js";
import TellerModule from "./Teller.js";
import VaultModule from "./Vault.js";

export default buildModule("PrimeVaultsFactoryModule", (m) => {
  const { vault } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);
  const { teller } = m.useModule(TellerModule);
  const { delayedWithdraw } = m.useModule(DelayedWithdrawModule);

  const primeVaultFactory = m.contract("PrimeVaultFactory", [], {
    after: [vault, accountant, teller, delayedWithdraw],
  });

  const rolesAuthority = m.contract("RolesAuthority", [primeVaultFactory], {
    after: [vault, accountant, teller, delayedWithdraw, primeVaultFactory],
  });

  m.call(accountant, "setAuthority", [rolesAuthority]);
  m.call(teller, "setAuthority", [rolesAuthority]);
  m.call(vault, "setAuthority", [rolesAuthority]);
  m.call(delayedWithdraw, "setAuthority", [rolesAuthority]);
  m.call(primeVaultFactory, "setup", [rolesAuthority, vault, accountant, teller]);

  return { primeVaultFactory, vault, accountant, teller, delayedWithdraw, rolesAuthority };
});
