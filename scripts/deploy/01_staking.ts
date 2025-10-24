import hre from "hardhat";

import StakingModule from "../../ignition/modules/staking.js";
import deployErc20 from "./00_mockERC20.js";

export default async function main() {
  const connection = await hre.network.connect({});
  const { mockERC20 } = await deployErc20();
  const { staking } = await connection.ignition.deploy(StakingModule, {
    parameters: {
      StakingModule: {
        token: mockERC20.address,
      },
    } as any,
  });
  return { staking, mockERC20 };
}

main().catch(console.error);
