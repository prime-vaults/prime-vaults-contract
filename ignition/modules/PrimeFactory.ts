import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import DistributorModule from "./Distributor.js";
import AccountantModule from "./vault/Accountant.js";
import TellerModule from "./vault/Teller.js";
import VaultModule from "./vault/Vault.js";
import WithdrawerModule from "./vault/Withdrawer.js";

/**
 * PrimeRegistry Module
 * Deploys the registry contracts that track all Prime Vault deployments
 */
export default buildModule("PrimeFactoryModule", (m) => {
  const { vault, rolesAuthority, primeRegistry, primeRBAC, decoder } = m.useModule(VaultModule);
  const { accountant } = m.useModule(AccountantModule);
  const { teller } = m.useModule(TellerModule);
  const { withdrawer } = m.useModule(WithdrawerModule);

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
    distributor,
    rolesAuthority,
  };
});
