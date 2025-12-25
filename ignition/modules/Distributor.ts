import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

import { ROLES } from "../constants.js";

/**
 * Distributor Module
 * Deploys Distributor for reward distribution
 */
const DistributorModule = buildModule("DistributorModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const teller = m.contractAt("TellerWithBuffer", m.getParameter("TellerAddress"));
  const rolesAuthority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

  const distributor = m.contract("Distributor", [primeRBAC, teller]);

  // Connect distributor to teller
  const tx1 = m.call(teller, "setDistributor", [distributor], {
    id: "setDistributor",
    after: [distributor],
  });

  const tx2 = m.call(rolesAuthority, "setPublicCapability", [distributor, toFunctionSelector("compoundReward(address)"), true], {
    id: "setPublicCapability_compoundReward",
    after: [tx1],
  });

  const tx3 = m.call(rolesAuthority, "setPublicCapability", [distributor, toFunctionSelector("setAllowThirdPartyCompound(bool)"), true], {
    id: "setPublicCapability_setAllowThirdPartyCompound",
    after: [tx2],
  });

  const tx4 = m.call(rolesAuthority, "setPublicCapability", [distributor, toFunctionSelector("claimRewards(address[])"), true], {
    id: "setPublicCapability_claimRewards",
    after: [tx3],
  });

  m.call(rolesAuthority, "setUserRole", [distributor, ROLES.SOLVER, true], {
    id: "setUserRole_SOLVER_Distributor",
    after: [tx4],
  });

  return { distributor, teller };
});

export default DistributorModule;
