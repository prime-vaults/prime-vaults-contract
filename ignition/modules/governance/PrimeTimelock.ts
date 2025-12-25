import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploy PrimeTimelock for role management
 *
 * PRIMARY PURPOSE: Control OWNER_ROLE to prevent instant rug pulls via role changes
 *
 * This timelock should control OWNER_ROLE in PrimeRBAC:
 * - Grant/revoke roles (especially OWNER_ROLE)
 * - Any changes to RolesAuthority
 *
 * Other operations (fees, rewards) don't need timelock because they have:
 * - Built-in safety limits (max 20% fee, etc.)
 * - Business logic constraints
 * - Pause mechanism for emergencies
 *
 * Deployment steps:
 * 1. Deploy this timelock (called automatically from scripts/deploy/05_timelock.ts)
 * 2. Transfer OWNER_ROLE to timelock in PrimeRBAC
 * 3. Renounce admin role on timelock (makes it fully decentralized)
 *
 * Example manual deployment:
 * ```bash
 * # Deploy timelock
 * pnpm hardhat ignition deploy ignition/modules/governance/PrimeTimelock.ts --network mainnet
 *
 * # Grant OWNER_ROLE to timelock
 * cast send $PRIME_RBAC "grantRole(bytes32,address)" \
 *   $(cast keccak "OWNER_ROLE") $TIMELOCK_ADDRESS --private-key $OWNER_KEY
 *
 * # Revoke OWNER_ROLE from current owner
 * cast send $PRIME_RBAC "revokeRole(bytes32,address)" \
 *   $(cast keccak "OWNER_ROLE") $CURRENT_OWNER --private-key $OWNER_KEY
 *
 * # Renounce admin (point of no return!)
 * cast send $TIMELOCK_ADDRESS "revokeRole(bytes32,address)" \
 *   $DEFAULT_ADMIN_ROLE $DEPLOYER_ADDRESS --private-key $DEPLOYER_KEY
 * ```
 */
export default buildModule("PrimeTimelockModule", (m) => {
  // Parameters with defaults
  const minDelay = m.getParameter("minDelay", 172800n); // 48 hours default
  const proposers = [m.getParameter("adminAddress")];
  const executors = m.getParameter<string[]>("executors", ["0x0000000000000000000000000000000000000000"]); // address(0) = anyone can execute
  const admin = m.getParameter("adminAddress"); // Will be deployer by default, should renounce after setup

  // Deploy timelock
  const timelock = m.contract("PrimeTimelock", [minDelay, proposers, executors, admin]);

  return { timelock };
});
