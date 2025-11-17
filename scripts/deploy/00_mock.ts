import { NetworkConnection } from "hardhat/types/network";

import DecoderModule from "../../ignition/modules/Decoder.js";
import MockERC20Module from "../../ignition/modules/MockERC20.js";
import MockStrategistModule from "../../ignition/modules/MockStrategist.js";
import { getParamsPath, readParams, writeParams } from "../../ignition/parameters/utils.js";

/**
 * Deploy mock contracts for testing
 * Deploys: MockERC20, MockStrategist, FullDecoderAndSanitizer
 */
export default async function deployMocks(connection: NetworkConnection, parameterId: string, displayUi = false) {
  // Deploy mock ERC20 token
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    parameters: getParamsPath(parameterId),
    displayUi,
  });

  // Deploy mock strategist
  const { mockStrategist } = await connection.ignition.deploy(MockStrategistModule, {
    parameters: getParamsPath(parameterId),
    displayUi,
  });

  // Deploy decoder/sanitizer
  const { decoder } = await connection.ignition.deploy(DecoderModule, {
    parameters: getParamsPath(parameterId),
    displayUi,
  });

  // Update parameters with deployed addresses
  const parameters = readParams(parameterId);
  parameters.$global.stakingToken = mockERC20.address;
  parameters.$global.PrimeStrategistAddress = mockStrategist.address;
  parameters.$global.DecoderAndSanitizerAddress = decoder.address;
  await writeParams(parameterId, parameters);

  if (displayUi) {
    console.table({
      MockERC20: mockERC20.address,
      MockStrategist: mockStrategist.address,
      Decoder: decoder.address,
    });
  }

  return { mockERC20, mockStrategist, decoder };
}
