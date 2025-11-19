import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Mock Strategist Module
 * Deploys a mock strategist contract for testing strategy execution
 */
export default buildModule("MockStrategistModule", (m) => {
  const mockStrategist = m.contract("MockStrategist");

  return { mockStrategist };
});
