import { NetworkConnection } from "hardhat/types/network";

import MockERC20Module from "../../ignition/modules/mocks/MockERC20.js";
import MockTokenBModule from "../../ignition/modules/mocks/MockTokenB.js";
import MockStrategistModule from "../../ignition/modules/mocks/MockStrategist.js";
import { getParamsPath, readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy mock contracts for testing
 * Deploys: MockERC20 (18 decimals), MockTokenB (6 decimals), MockStrategist
 */
export default async function deployMocks(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Deploy mock ERC20 token (18 decimals)
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    parameters: getParamsPath(parameterId),
    displayUi,
    deploymentId: parameterId + "-tokenA",
  });

  // Deploy mock Token B (6 decimals for testing low-decimal rewards)
  const { mockERC20: mockTokenB } = await connection.ignition.deploy(MockTokenBModule, {
    parameters: getParamsPath(parameterId),
    displayUi,
    deploymentId: parameterId + "-tokenB",
  });

  // Deploy mock strategist
  const { mockStrategist } = await connection.ignition.deploy(MockStrategistModule, {
    parameters: getParamsPath(parameterId),
    displayUi,
    deploymentId: parameterId,
  });

  const [deployer] = await connection.viem.getWalletClients();
  const parameters = readParams(parameterId);

  parameters.$global.stakingToken = mockERC20.address;
  parameters.$global.adminAddress = deployer.account.address;
  parameters.$global.PrimeStrategistAddress = mockStrategist.address;

  await writeParams(parameterId, parameters);

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
