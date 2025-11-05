import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import RolesAuthorityModule from "./RolesAuthority.js";

export default buildModule("VaultModule", (m) => {
  const { rolesAuthority } = m.useModule(RolesAuthorityModule);

  const vault = m.contract(
    "BoringVault",
    [m.getParameter("adminAddress"), m.getParameter("name"), m.getParameter("symbol"), m.getParameter("decimals")],
    {
      after: [rolesAuthority],
    },
  );
  m.call(vault, "setAuthority", [rolesAuthority]);

  return { vault, rolesAuthority };
});
