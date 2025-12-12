import { NetworkConnection } from "hardhat/types/network";

import { readParams, writeParams } from "../../ignition/parameters/utils.js";
import { createMerkleTree } from "../createMerkleTree.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Update Merkle tree root in Manager contract
 * Regenerates Merkle tree from current parameters and updates on-chain root
 */
export default async function updateMerkleTree(connection: NetworkConnection, parameterId: string) {
  const parameters = readParams(parameterId);

  // Get Manager contract
  const manager = await connection.viem.getContractAt("ManagerWithMerkleVerification", parameters.$global.ManagerAddress);

  // Get strategist address (PrimeStrategist)
  const strategistAddress = parameters.$global.PrimeStrategistAddress;

  // Get current root on-chain
  const currentRoot = await manager.read.manageRoot([strategistAddress]);
  console.log(`Current Merkle root: ${currentRoot}`);

  // Regenerate Merkle tree from parameters
  console.log("\nRegenerating Merkle tree from parameters...");
  const tree = await createMerkleTree(parameters);

  console.log(`New Merkle root: ${tree.root}`);
  console.log(`Total leaves: ${tree.leafs.length}`);

  // Check if root has changed
  if (currentRoot === tree.root) {
    console.log("\n✅ Merkle root unchanged. No update needed.");
    return;
  }

  // Update parameters file with new tree
  parameters.ManagerModule = {
    manageRoot: tree.root,
    leafs: tree.leafs,
  };
  await writeParams(parameterId, parameters);
  console.log("\n📝 Updated parameters file with new Merkle tree");

  // Update on-chain root
  console.log("\n🔄 Updating Merkle root on-chain...");
  const txHash = await manager.write.setManageRoot([strategistAddress, tree.root]);

  // Wait for transaction confirmation
  await (await connection.viem.getPublicClient()).waitForTransactionReceipt({ hash: txHash });

  console.log(`✅ Merkle root updated successfully!`);
  console.log(`Transaction hash: ${txHash}`);

  // Display leaf summary
  console.log("\n📋 Merkle Tree Leaves:");
  tree.leafs.forEach((leaf, index) => {
    console.log(`  [${index}] ${leaf.Description}`);
    console.log(`      Function: ${leaf.FunctionSignature}`);
    console.log(`      Target: ${leaf.TargetAddress}`);
    console.log(`      Digest: ${leaf.LeafDigest}`);
  });
}

// pnpm hardhat run scripts/tasks/updateMerkleTree.ts --network <network>
runHardhatCmd("scripts/tasks/updateMerkleTree.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n🌳 Updating Merkle Tree...\n");
    await updateMerkleTree(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
