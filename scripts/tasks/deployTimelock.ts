import { NetworkConnection } from "hardhat/types/network";
import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy PrimeTimelock for governance
 *
 * This script deploys a timelock controller that should control PROTOCOL_ADMIN_ROLE.
 * After deployment, you need to:
 * 1. Grant PROTOCOL_ADMIN_ROLE to timelock
 * 2. Test timelock operations
 * 3. Renounce admin role on timelock (point of no return!)
 *
 * See docs/TIMELOCK_DEPLOYMENT.md for full guide
 */
export default async function deployTimelock(connection: NetworkConnection, parameterId: string) {
  const parameters = await readParams(parameterId);

  console.log("\n🔒 Deploying PrimeTimelock...\n");

  // Get deployment parameters
  const minDelay = parameters.PrimeTimelockModule?.minDelay || "172800"; // 48 hours
  const proposers = parameters.PrimeTimelockModule?.proposers || [];
  const executors = parameters.PrimeTimelockModule?.executors || ["0x0000000000000000000000000000000000000000"];
  const admin = parameters.PrimeTimelockModule?.admin;

  if (proposers.length === 0 || proposers[0] === "0x0000000000000000000000000000000000000000") {
    console.error("❌ ERROR: You must set proposer addresses in parameters file!");
    console.error("   Edit ignition/parameters/" + parameterId + ".json");
    console.error("   Set PrimeTimelockModule.proposers to your multi-sig address");
    return;
  }

  if (!admin || admin === "0x0000000000000000000000000000000000000000") {
    console.error("❌ ERROR: You must set admin address in parameters file!");
    console.error("   Edit ignition/parameters/" + parameterId + ".json");
    console.error("   Set PrimeTimelockModule.admin to your admin address");
    return;
  }

  console.log("📋 Deployment Configuration:");
  console.log(`   Minimum Delay: ${minDelay} seconds (${Number(minDelay) / 3600} hours)`);
  console.log(`   Proposers: ${proposers.join(", ")}`);
  console.log(`   Executors: ${executors.join(", ")}`);
  console.log(`   Admin: ${admin}`);
  console.log("");

  // Deploy timelock
  const PrimeTimelockFactory = await connection.viem.getContractFactory("PrimeTimelock");
  const timelock = await PrimeTimelockFactory.deploy(
    BigInt(minDelay),
    proposers,
    executors,
    admin
  );

  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();

  console.log(`✅ PrimeTimelock deployed at: ${timelockAddress}\n`);

  // Get role hashes
  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  console.log("🔑 Role Information:");
  console.log(`   PROPOSER_ROLE: ${proposerRole}`);
  console.log(`   EXECUTOR_ROLE: ${executorRole}`);
  console.log(`   DEFAULT_ADMIN_ROLE: ${adminRole}`);
  console.log("");

  // Verify roles
  console.log("✅ Verifying role assignments:");
  for (const proposer of proposers) {
    const hasRole = await timelock.hasRole(proposerRole, proposer);
    console.log(`   ${proposer} has PROPOSER_ROLE: ${hasRole}`);
  }

  for (const executor of executors) {
    if (executor !== "0x0000000000000000000000000000000000000000") {
      const hasRole = await timelock.hasRole(executorRole, executor);
      console.log(`   ${executor} has EXECUTOR_ROLE: ${hasRole}`);
    }
  }

  const hasAdminRole = await timelock.hasRole(adminRole, admin);
  console.log(`   ${admin} has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
  console.log("");

  // Next steps
  console.log("📝 Next Steps:\n");
  console.log("1. Transfer OWNER_ROLE to timelock:");
  console.log(`   # Grant OWNER_ROLE to timelock`);
  console.log(`   cast send ${parameters.$global?.PrimeRBACAddress || "<PRIME_RBAC_ADDRESS>"} \\`);
  console.log(`     "grantRole(bytes32,address)" \\`);
  console.log(`     "$(cast keccak 'OWNER_ROLE')" \\`);
  console.log(`     ${timelockAddress} \\`);
  console.log(`     --private-key $OWNER_PRIVATE_KEY\n`);

  console.log(`   # Revoke OWNER_ROLE from current owner`);
  console.log(`   cast send ${parameters.$global?.PrimeRBACAddress || "<PRIME_RBAC_ADDRESS>"} \\`);
  console.log(`     "revokeRole(bytes32,address)" \\`);
  console.log(`     "$(cast keccak 'OWNER_ROLE')" \\`);
  console.log(`     $CURRENT_OWNER_ADDRESS \\`);
  console.log(`     --private-key $OWNER_PRIVATE_KEY\n`);

  console.log("2. Test role management through timelock (see docs/TIMELOCK_DEPLOYMENT.md)\n");

  console.log("3. After successful testing, renounce timelock admin role:");
  console.log(`   cast send ${timelockAddress} \\`);
  console.log(`     "revokeRole(bytes32,address)" \\`);
  console.log(`     ${adminRole} \\`);
  console.log(`     ${admin} \\`);
  console.log(`     --private-key $ADMIN_PRIVATE_KEY\n`);

  console.log("⚠️  WARNING: Step 3 is irreversible! Only do this after thorough testing.\n");
  console.log("💡 TIP: Timelock is ONLY for role management. Fee/reward changes don't need timelock.");

  // Save deployment info
  console.log("💾 Save this information:");
  console.log(JSON.stringify({
    network: connection.network,
    timelockAddress,
    minDelay,
    proposers,
    executors,
    admin,
    roles: {
      PROPOSER_ROLE: proposerRole,
      EXECUTOR_ROLE: executorRole,
      DEFAULT_ADMIN_ROLE: adminRole,
    }
  }, null, 2));

  return { timelock, timelockAddress };
}

// pnpm hardhat run scripts/tasks/deployTimelock.ts --network <network>
runHardhatCmd("scripts/tasks/deployTimelock.ts")
  .then(async (context) => {
    if (!context) return;
    await deployTimelock(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
