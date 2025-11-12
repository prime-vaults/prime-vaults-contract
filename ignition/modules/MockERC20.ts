import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Mock ERC20 Module
 * Deploys a mock ERC20 token for testing purposes
 */
export default buildModule("MockERC20Module", (m) => {
  const mockERC20 = m.contract("MockERC20", ["Mock Token", "MOCK", 18]);
  return { mockERC20 };
});
