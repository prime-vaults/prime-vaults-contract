import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";

/**
 * Distributor Module
 * Deploys Distributor for reward distribution
 */
const DistributorModule = buildModule("DistributorModule", (m) => {
  const primeRBAC = m.contractAt("PrimeRBAC", m.getParameter("PrimeRBAC"));
  const teller = m.contractAt("TellerWithBuffer", m.getParameter("TellerAddress"));
  const authority = m.contractAt("RolesAuthority", m.getParameter("RolesAuthorityAddress"));

  const distributor = m.contract("Distributor", [primeRBAC, teller]);

  // Connect distributor to teller
  const tx1 = m.call(teller, "setDistributor", [distributor], {
    id: "setDistributor",
    after: [distributor],
  });

  const tx2 = m.call(authority, "setPublicCapability", [distributor, toFunctionSelector("compoundReward(address)"), true], {
    id: "setPublicCapability_compoundReward",
    after: [tx1],
  });

  const tx3 = m.call(authority, "setPublicCapability", [distributor, toFunctionSelector("setAllowThirdPartyCompound(bool)"), true], {
    id: "setPublicCapability_setAllowThirdPartyCompound",
    after: [tx2],
  });

  m.call(authority, "setPublicCapability", [distributor, toFunctionSelector("claimRewards(address[])"), true], {
    id: "setPublicCapability_claimRewards",
    after: [tx3],
  });

  return { distributor, teller };
});

export default DistributorModule;
