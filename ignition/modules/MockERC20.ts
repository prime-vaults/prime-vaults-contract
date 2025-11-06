import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockERC20Module", (m) => {
  const mockERC20 = m.contract("MockERC20", ["Mock Token", "MOCK", 18]);
  return { mockERC20 };
});
