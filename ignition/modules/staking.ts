import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("StakingModule", (m) => {
  const staking = m.contract("Staking", [m.getParameter("token")]);
  return { staking };
});
