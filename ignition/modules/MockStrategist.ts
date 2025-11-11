import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockStrategistModule", (m) => {
  const mockStrategist = m.contract("MockStrategist");
  return { mockStrategist };
});
