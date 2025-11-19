import { NetworkConnection } from "hardhat/types/network";

import MockERC20Module from "../../ignition/modules/mocks/MockERC20.js";
import MockStrategistModule from "../../ignition/modules/mocks/MockStrategist.js";
import { getParamsPath, readParams, writeParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy mock contracts for testing
 * Deploys: MockERC20, MockStrategist
 */
export default async function deployMocks(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Deploy mock ERC20 token
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    parameters: getParamsPath(parameterId),
    displayUi,
    deploymentId: parameterId,
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
      MockERC20: mockERC20.address,
      MockStrategist: mockStrategist.address,
    });
  }

  return { mockERC20, mockStrategist };
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
