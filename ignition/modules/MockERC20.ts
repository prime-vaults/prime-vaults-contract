import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockERC20Module", (m) => {
  const mockERC20 = m.contract("MockERC20", ["Mock Token", "MOCK", 18]);

  m.call(mockERC20, "mint", [m.getParameter("adminAddress"), 10n ** 18n]);
  return { mockERC20 };
});
