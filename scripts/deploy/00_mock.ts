import { NetworkConnection } from "hardhat/types/network";

import Decoder from "../../ignition/modules/Decoder.js";
import MockERC20Module from "../../ignition/modules/MockERC20.js";
import MockStrategist from "../../ignition/modules/MockStrategist.js";
import { getParamsPath, readParams, writeParams } from "../../ignition/parameters/utils.js";

export default async function deployMocks(connection: NetworkConnection, parameterId: string) {
  const { mockERC20 } = await connection.ignition.deploy(MockERC20Module, {
    parameters: getParamsPath(parameterId),
    displayUi: true,
  });
  const { mockStrategist } = await connection.ignition.deploy(MockStrategist, {
    parameters: getParamsPath(parameterId),
    displayUi: true,
  });
  const { decoder } = await connection.ignition.deploy(Decoder, {
    parameters: getParamsPath(parameterId),
    displayUi: true,
  });

  const parameters = readParams(parameterId);
  parameters.$global.stakingToken = mockERC20.address;
  parameters.$global.PrimeStrategistAddress = mockStrategist.address;
  parameters.$global.DecoderAndSanitizerAddress = decoder.address;
  await writeParams(parameterId, parameters);

  console.table({
    MockERC20: mockERC20.address,
    MockStrategist: mockStrategist.address,
    Decoder: decoder.address,
  });
  return { mockERC20, mockStrategist, decoder };
}
