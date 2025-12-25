import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Mock Token B Module
 * Deploys a mock ERC20 token with 6 decimals for testing multi-reward scenarios
 */
export default buildModule("MockTokenBModule", (m) => {
  const mockERC20 = m.contract("MockERC20", ["Mock Token B", "MOCKB", 6]);
  return { mockERC20 };
});
