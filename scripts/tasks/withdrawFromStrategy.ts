import { NetworkConnection } from "hardhat/types/network";
import { encodeFunctionData, parseUnits } from "viem";

import { readParams } from "../../ignition/parameters/utils.js";
import { readLeaf } from "../createMerkleTree.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Withdraw tokens from PrimeStrategist back to vault via Manager with Merkle verification
 * This demonstrates how to pull funds from strategy through Merkle proofs
 */
export default async function withdrawFromStrategy(connection: NetworkConnection, parameterId: string) {
  const parameters = await readParams(parameterId);

  // Get contracts
  const manager = await connection.viem.getContractAt("ManagerWithMerkleVerification", parameters.$global.ManagerAddress);
  const vault = await connection.viem.getContractAt("BoringVault", parameters.$global.BoringVaultAddress);
  const mockERC20 = await connection.viem.getContractAt("MockERC20", parameters.$global.stakingToken);
  const strategist = await connection.viem.getContractAt("MockStrategist", parameters.$global.PrimeStrategistAddress);

  // Get admin account
  const [adminAccount] = await connection.viem.getWalletClients();

  // Define withdraw amount (10 tokens)
  const withdrawAmount = parseUnits("10", 18);

  console.log("\n📊 Current State:");
  const vaultBalance = await mockERC20.read.balanceOf([vault.address]);
  const strategistBalance = await mockERC20.read.balanceOf([strategist.address]);
  console.log(`Vault balance: ${vaultBalance}`);
  console.log(`Strategist balance: ${strategistBalance}`);

  // Get Merkle proof for withdraw(address,uint256)
  console.log("\n📋 Getting Merkle proof for withdraw...");
  const withdrawLeaf = await readLeaf(parameterId, {
    FunctionSignature: "withdraw(address,uint256)",
    Description: "Withdraw from PrimeStrategist back to vault",
  });

  if (!withdrawLeaf) {
    throw new Error("Withdraw leaf not found in Merkle tree");
  }

  console.log(`Withdraw leaf index: ${withdrawLeaf.index}`);
  console.log(`Withdraw leaf digest: ${withdrawLeaf.leaf.LeafDigest}`);
  console.log(`Withdraw proof length: ${withdrawLeaf.proof.length}`);

  // Prepare call data for withdraw
  // Note: MockStrategist.withdraw() only takes (address asset, uint256 amount)
  // It automatically transfers to msg.sender (BoringVault)
  const withdrawCallData = encodeFunctionData({
    abi: strategist.abi,
    functionName: "withdraw",
    args: [parameters.$global.stakingToken, withdrawAmount],
  });

  // Execute manage vault with Merkle verification
  console.log("\n🔄 Executing manageVaultWithMerkleVerification...");
  console.log(`Withdrawing ${withdrawAmount} tokens from PrimeStrategist...`);

  const txHash = await manager.write.manageVaultWithMerkleVerification(
    [
      [withdrawLeaf.proof], // manageProofs
      [withdrawLeaf.leaf.DecoderAndSanitizerAddress], // decodersAndSanitizers
      [withdrawLeaf.leaf.TargetAddress], // targets
      [withdrawCallData], // targetData
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
  console.log(`Vault balance: ${vaultBalanceAfter} (+${vaultBalanceAfter - vaultBalance})`);
  console.log(`Strategist balance: ${strategistBalanceAfter} (${strategistBalanceAfter - strategistBalance})`);

  console.log("\n✅ Successfully withdrawn from strategy!");
}

// pnpm hardhat run scripts/tasks/withdrawFromStrategy.ts --network <network>
runHardhatCmd("scripts/tasks/withdrawFromStrategy.ts")
  .then(async (context) => {
    if (!context) return;
    console.log("\n💸 Withdrawing from Strategy via Merkle...\n");
    await withdrawFromStrategy(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
