import { NetworkConnection } from "hardhat/types/network";
import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Transfer OWNER_ROLE from current owner to PrimeTimelock
 *
 * This is a critical security step that prevents instant rug pulls by requiring
 * 48h delay for all role changes.
 *
 * WARNING: After this, you cannot instantly grant/revoke roles!
 * All role changes will require 48h timelock delay.
 */
export default async function transferOwnerToTimelock(connection: NetworkConnection, parameterId: string) {
  const parameters = readParams(parameterId);

  console.log("\n🔐 Transferring OWNER_ROLE to PrimeTimelock...\n");

  // Get contract addresses
  const primeRBACAddress = parameters.$global?.PrimeRBACAddress;
  const timelockAddress = parameters.$global?.PrimeTimelockAddress;

  if (!primeRBACAddress) {
    throw new Error("PrimeRBACAddress not found in parameters!");
  }

  if (!timelockAddress) {
    throw new Error("PrimeTimelockAddress not found in parameters! Deploy timelock first.");
  }

  // Get contracts
  const primeRBAC = await connection.viem.getContractAt("PrimeRBAC", primeRBACAddress);
  const [adminAccount] = await connection.viem.getWalletClients();

  // Get OWNER_ROLE hash
  const OWNER_ROLE = await primeRBAC.read.OWNER_ROLE();

  console.log("📋 Configuration:");
  console.log(`   PrimeRBAC: ${primeRBACAddress}`);
  console.log(`   Timelock: ${timelockAddress}`);
  console.log(`   OWNER_ROLE: ${OWNER_ROLE}`);
  console.log(`   Current Admin: ${adminAccount.account.address}\n`);

  // Check current state
  const currentOwnerHasRole = await primeRBAC.read.hasRole([OWNER_ROLE, adminAccount.account.address]);
  const timelockHasRole = await primeRBAC.read.hasRole([OWNER_ROLE, timelockAddress]);

  console.log("📊 Current State:");
  console.log(`   Current admin has OWNER_ROLE: ${currentOwnerHasRole}`);
  console.log(`   Timelock has OWNER_ROLE: ${timelockHasRole}\n`);

  if (timelockHasRole) {
    console.log("✅ Timelock already has OWNER_ROLE!");
    if (currentOwnerHasRole) {
      console.log("⚠️  Current admin still has OWNER_ROLE - will revoke it now.\n");
    } else {
      console.log("✅ Transfer already complete! Nothing to do.\n");
      return;
    }
  }

  // Step 1: Grant OWNER_ROLE to timelock
  if (!timelockHasRole) {
    console.log("🔄 Step 1: Granting OWNER_ROLE to timelock...");
    const grantTx = await primeRBAC.write.grantRole([OWNER_ROLE, timelockAddress], {
      account: adminAccount.account,
    });

    console.log(`   Transaction sent: ${grantTx}`);
    await connection.viem.getPublicClient().then((client) => client.waitForTransactionReceipt({ hash: grantTx }));
    console.log("   ✅ OWNER_ROLE granted to timelock!\n");
  }

  // Step 2: Revoke OWNER_ROLE from current owner
  if (currentOwnerHasRole) {
    console.log("🔄 Step 2: Revoking OWNER_ROLE from current admin...");
    console.log("   ⚠️  WARNING: After this, you cannot instantly grant/revoke roles!");
    console.log("   ⚠️  All role changes will require 48h timelock delay.\n");

    // Wait for user confirmation in production
    if (connection.network === "mainnet" || connection.network === "base") {
      console.log("   🛑 PRODUCTION NETWORK DETECTED!");
      console.log("   Please confirm this is what you want to do.");
      console.log("   Run this script with --confirm flag to proceed.\n");

      if (!process.argv.includes("--confirm")) {
        console.log("   ❌ Transfer cancelled. Use --confirm flag to proceed.");
        return;
      }
    }

    const revokeTx = await primeRBAC.write.revokeRole([OWNER_ROLE, adminAccount.account.address], {
      account: adminAccount.account,
    });

    console.log(`   Transaction sent: ${revokeTx}`);
    await connection.viem.getPublicClient().then((client) => client.waitForTransactionReceipt({ hash: revokeTx }));
    console.log("   ✅ OWNER_ROLE revoked from current admin!\n");
  }

  // Verify final state
  console.log("🔍 Verifying final state...");
  const finalOwnerHasRole = await primeRBAC.read.hasRole([OWNER_ROLE, adminAccount.account.address]);
  const finalTimelockHasRole = await primeRBAC.read.hasRole([OWNER_ROLE, timelockAddress]);

  console.log(`   Current admin has OWNER_ROLE: ${finalOwnerHasRole}`);
  console.log(`   Timelock has OWNER_ROLE: ${finalTimelockHasRole}\n`);

  if (!finalOwnerHasRole && finalTimelockHasRole) {
    console.log("✅ Transfer complete! OWNER_ROLE is now controlled by timelock.");
    console.log("\n📝 Next Steps:");
    console.log("1. All role changes now require 48h delay");
    console.log("2. Test timelock operations on testnet");
    console.log("3. After successful testing, renounce timelock admin role");
    console.log("\nSee docs/TIMELOCK_DEPLOYMENT.md for usage examples.\n");
  } else {
    console.log("❌ Transfer failed! Please check the state manually.\n");
    throw new Error("Transfer verification failed");
  }
}

// pnpm hardhat run scripts/tasks/transferOwnerToTimelock.ts --network <network>
// Add --confirm flag for mainnet: pnpm hardhat run scripts/tasks/transferOwnerToTimelock.ts --network mainnet --confirm
runHardhatCmd("scripts/tasks/transferOwnerToTimelock.ts")
  .then(async (context) => {
    if (!context) return;
    await transferOwnerToTimelock(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
