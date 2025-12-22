import { NetworkConnection } from "hardhat/types/network";

import MockERC20Module from "../../ignition/modules/mocks/MockERC20.js";
import MockStrategistModule from "../../ignition/modules/mocks/MockStrategist.js";
import MockTokenBModule from "../../ignition/modules/mocks/MockTokenB.js";
import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy mock contracts for testing
 * Deploys: MockERC20 (18 decimals), MockTokenB (6 decimals), MockStrategist
 */
export default async function deployMocks(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Deploy mock ERC20 token (18 decimals)
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    displayUi,
    deploymentId: parameterId + "-tokenA",
  });

  // Deploy mock Token B (6 decimals for testing low-decimal rewards)
  const { mockERC20: mockTokenB } = await connection.ignition.deploy(MockTokenBModule, {
    displayUi,
    deploymentId: parameterId + "-tokenB",
  });

  // Deploy mock strategist
  const { mockStrategist } = await connection.ignition.deploy(MockStrategistModule, {
    displayUi,
    deploymentId: parameterId,
  });

  const chainCommon = await readParams(connection.networkName);
  await writeParams(parameterId, chainCommon);

  chainCommon.$global.stakingToken = mockERC20.address;
  chainCommon.$global.PrimeStrategistAddress = mockStrategist.address;

  console.log("Writing updated mock addresses to parameters...", chainCommon);
  await writeParams(parameterId, chainCommon);

  if (displayUi) {
    console.table({
      "MockERC20 (18 decimals)": mockERC20.address,
      "MockTokenB (6 decimals)": mockTokenB.address,
      MockStrategist: mockStrategist.address,
    });
  }

  return { mockERC20, mockTokenB, mockStrategist };
}

// pnpm hardhat run scripts/deploy/00_mock.ts --network <network>
runHardhatCmd("scripts/deploy/00_mock.ts")
  .then(async (context) => {
    if (!context) return;
    await deployMocks(context.connection, context.parameters, true);
  })
  .catch((error) => {
    console.error(error);
  });
