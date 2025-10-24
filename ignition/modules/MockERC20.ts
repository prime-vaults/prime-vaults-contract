import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockERC20Module", (m) => {
  const mockERC20 = m.contract("MockERC20", [
    m.getParameter("name"),
    m.getParameter("symbol"),
    m.getParameter("decimals"),
  ]);
  return { mockERC20 };
});
