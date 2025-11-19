import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import DistributorModule from "./Distributor.js";
import ManagerModule from "./Manager.js";
import PrimeRegistryModule from "./PrimeRegistry.js";
import AccountantModule from "./vault/Accountant.js";
import TellerModule from "./vault/Teller.js";
import VaultModule from "./vault/Vault.js";
import WithdrawerModule from "./vault/Withdrawer.js";

/**
 * PrimeRegistry Module
 * Deploys the registry contracts that track all Prime Vault deployments
 */
export default buildModule("PrimeFactoryModule", (m) => {
  const { primeRegistry, primeRBAC, decoder } = m.useModule(PrimeRegistryModule);
  const { vault, rolesAuthority } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);
  const { teller } = m.useModule(TellerModule);
  const { withdrawer } = m.useModule(WithdrawerModule);

  // Deploy Manager
  const { manager } = m.useModule(ManagerModule);
  // Deploy Distributor
  const { distributor } = m.useModule(DistributorModule);

  return {
    primeRegistry,
    primeRBAC,
    decoder,
    vault,
    accountant,
    teller,
    withdrawer,
    manager,
    distributor,
    rolesAuthority,
  };
});
