import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Mock ERC20 Module
 * Deploys a mock ERC20 token for testing purposes
 */
export default buildModule("MockERC20Module", (m) => {
  const adminAddress = m.getParameter("adminAddress");

  // Deploy mock token
  const mockERC20 = m.contract("MockERC20", ["Mock Token", "MOCK", 18]);

  // Mint initial supply to admin
  m.call(mockERC20, "mint", [adminAddress, 10n ** 18n], { id: "mockERC20_initialMint" });

  return { mockERC20 };
});
