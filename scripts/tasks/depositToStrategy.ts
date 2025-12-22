import { NetworkConnection } from "hardhat/types/network";
import { encodeFunctionData, parseUnits } from "viem";

import { readParams } from "../../ignition/parameters/utils.js";
import { readLeaf } from "../createMerkleTree.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deposit tokens to PrimeStrategist via Manager with Merkle verification
 * This demonstrates how to execute vault management through Merkle proofs
 */
export default async function depositToStrategy(connection: NetworkConnection, parameterId: string) {
  const parameters = await readParams(parameterId);

  // Get contracts
  const manager = await connection.viem.getContractAt("ManagerWithMerkleVerification", parameters.$global.ManagerAddress);
  const vault = await connection.viem.getContractAt("BoringVault", parameters.$global.BoringVaultAddress);
  const mockERC20 = await connection.viem.getContractAt("MockERC20", parameters.$global.stakingToken);
  const strategist = await connection.viem.getContractAt("MockStrategist", parameters.$global.PrimeStrategistAddress);

  // Get admin account
  const [adminAccount] = await connection.viem.getWalletClients();

  // Define deposit amount (10 tokens)
  const depositAmount = parseUnits("10", 18);

  console.log("\n📊 Current State:");
  const vaultBalance = await mockERC20.read.balanceOf([vault.address]);
  const strategistBalance = await mockERC20.read.balanceOf([strategist.address]);
  console.log(`Vault balance: ${vaultBalance}`);
  console.log(`Strategist balance: ${strategistBalance}`);

  // Step 1: Get Merkle proof for approve(address,uint256) - Approve PrimeStrategist
  console.log("\n📋 Step 1: Getting Merkle proof for approve...");
  const approveLeaf = await readLeaf(parameterId, {
    // FunctionSignature: "approve(address,uint256)",
    Description: "Approve PrimeStrategist to spend base asset (staking token)",
  });

  if (!approveLeaf) {
    throw new Error("Approve leaf not found in Merkle tree");
  }

  console.log(`Approve leaf index: ${approveLeaf.index}`);
  console.log(`Approve leaf digest: ${approveLeaf.leaf.LeafDigest}`);
  console.log(`Approve proof length: ${approveLeaf.proof.length}`);

  // Step 3: Prepare call data for approve
  const approveCallData = encodeFunctionData({
    abi: mockERC20.abi,
    functionName: "approve",
    args: [parameters.$global.PrimeStrategistAddress, depositAmount],
  });

  // Step 5: Execute manage vault with Merkle verification
  console.log("\n🔄 Executing manageVaultWithMerkleVerification...");
  console.log(`Approving ${depositAmount} tokens for PrimeStrategist...`);

  const txHash = await manager.write.manageVaultWithMerkleVerification(
    [
      [approveLeaf.proof], // manageProofs
      [approveLeaf.leaf.DecoderAndSanitizerAddress], // decodersAndSanitizers
      [approveLeaf.leaf.TargetAddress], // targets
      [approveCallData], // targetData
      [0n], // values (no ETH sent)
    ],
    {
      account: adminAccount.account,
    },
  );

  console.log(`\n✅ Transaction sent: ${txHash}`);

  // Wait for confirmation
  await connection.viem.getPublicClient().then((client) => client.waitForTransactionReceipt({ hash: txHash }));

  console.log(`✅ Transaction confirmed!`);

  // Check balances after
  console.log("\n📊 Final State:");
  const vaultBalanceAfter = await mockERC20.read.balanceOf([vault.address]);
  const strategistBalanceAfter = await mockERC20.read.balanceOf([strategist.address]);
  console.log(`Vault balance: ${vaultBalanceAfter} (${vaultBalanceAfter - vaultBalance})`);
  console.log(`Strategist balance: ${strategistBalanceAfter} (+${strategistBalanceAfter - strategistBalance})`);

  console.log("\n✅ Successfully deposited to strategy!");
}

// pnpm hardhat run scripts/tasks/depositToStrategy.ts --network <network>
runHardhatCmd("scripts/tasks/depositToStrategy.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n💰 Depositing to Strategy via Merkle...\n");
    await depositToStrategy(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
