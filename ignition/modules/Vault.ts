import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VaultModule", (m) => {
  const vault = m.contract("BoringVault", [
    m.getParameter("adminAddress"),
    m.getParameter("name"),
    m.getParameter("symbol"),
    m.getParameter("decimals"),
  ]);
  return { vault };
});
