import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RolesAuthorityModule", (m) => {
  const rolesAuthority = m.contract("RolesAuthority", [m.getParameter("adminAddress")]);
  return { rolesAuthority };
});
