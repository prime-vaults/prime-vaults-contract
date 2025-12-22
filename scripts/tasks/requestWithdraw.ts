import { NetworkConnection } from "hardhat/types/network";

import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Request withdrawal from vault
 * User approves withdrawer and requests to withdraw shares
 */
export default async function requestWithdraw(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const vault = await connection.viem.getContractAt("BoringVault", parameters.$global.BoringVaultAddress);
  const withdrawer = await connection.viem.getContractAt("DelayedWithdraw", parameters.$global.WithdrawerAddress);

  // Get user account
  const [userAccount] = await connection.viem.getWalletClients();

  // Get user's share balance
  const userShares = await vault.read.balanceOf([userAccount.account.address]);

  if (userShares === 0n) {
    console.log("No shares to withdraw");
    return;
  }

  console.log(`User shares: ${userShares}`);

  // Step 1: Approve withdrawer to spend shares
  const txApprove = await vault.write.approve([withdrawer.address, userShares]);
  await (await connection.viem.getPublicClient()).waitForTransactionReceipt({ hash: txApprove });
  console.log(`Approved withdrawer: ${txApprove}`);

  // Step 2: Request withdrawal
  const txRequest = await withdrawer.write.requestWithdraw([userShares, false]);
  await (await connection.viem.getPublicClient()).waitForTransactionReceipt({ hash: txRequest });
  console.log(`Withdrawal requested: ${txRequest}`);

  // Get withdrawal request details
  const withdrawRequest = await withdrawer.read.getWithdrawRequest([userAccount.account.address]);
  console.log(`Withdraw request details:
  - Shares: ${withdrawRequest.shares}
  - Fee: ${withdrawRequest.sharesFee}
  - Maturity: ${new Date(Number(withdrawRequest.maturity) * 1000).toISOString()}
  `);
}

// pnpm hardhat run scripts/tasks/requestWithdraw.ts --network <network>
runHardhatCmd("scripts/tasks/requestWithdraw.ts")
  .then(async (context) => {
    if (!context) return;
    await requestWithdraw(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
