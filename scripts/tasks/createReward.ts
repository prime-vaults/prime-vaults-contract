import { NetworkConnection } from "hardhat/types/network";
import prompts from "prompts";

import { readParams } from "../../ignition/parameters/utils.js";
import { ONE_DAY_SECS } from "../../sdk/constant.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function createReward(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const parameters = readParams(parameterId);

  const distributor = await connection.viem.getContractAt("Distributor", parameters.$global.DistributorAddress);

  const rewardToken = await prompts({
    type: "text",
    name: "value",
    message: `Enter the reward token address:`,
  });

  await distributor.write.addReward([rewardToken.value, ONE_DAY_SECS]);
}

// pnpm hardhat run scripts/tasks/createReward.ts --network <network>
runHardhatCmd("scripts/tasks/createReward.ts")
  .then(async (context) => {
    if (!context) return;
    await createReward(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
