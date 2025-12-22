import { NetworkConnection } from "hardhat/types/network";

import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Complete withdrawal from vault
 * User completes pending withdrawal request after maturity period
 */
export default async function completeWithdraw(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const parameters = await readParams(parameterId);

  const withdrawer = await connection.viem.getContractAt("DelayedWithdraw", parameters.$global.WithdrawerAddress);
  const mockERC20 = await connection.viem.getContractAt("MockERC20", parameters.$global.stakingToken);

  // Get user account
  const [userAccount] = await connection.viem.getWalletClients();

  // Get withdrawal request details
  const withdrawRequest = await withdrawer.read.getWithdrawRequest([userAccount.account.address]);

  if (withdrawRequest.shares === 0n) {
    console.log("No pending withdrawal request");
    return;
  }

  const currentTime = BigInt(Math.floor(Date.now() / 1000));
  const maturity = withdrawRequest.maturity;

  console.log(`Withdraw request details:
  - Shares: ${withdrawRequest.shares}
  - Fee: ${withdrawRequest.sharesFee}
  - Maturity: ${new Date(Number(maturity) * 1000).toISOString()}
  - Current time: ${new Date(Number(currentTime) * 1000).toISOString()}
  `);

  // Get user balance before
  const balanceBefore = await mockERC20.read.balanceOf([userAccount.account.address]);

  // Calculate minimum assets (0 for no slippage protection, or set a specific value)
  const minimumAssets = 0n;

  // Complete withdrawal
  const txComplete = await withdrawer.write.completeWithdraw([userAccount.account.address, minimumAssets]);
  await (await connection.viem.getPublicClient()).waitForTransactionReceipt({ hash: txComplete });
  console.log(`Withdrawal completed: ${txComplete}`);

  // Get user balance after
  const balanceAfter = await mockERC20.read.balanceOf([userAccount.account.address]);
  const tokensReceived = balanceAfter - balanceBefore;

  console.log(`Tokens received: ${tokensReceived}`);
}

// pnpm hardhat run scripts/tasks/completeWithdraw.ts --network <network>
runHardhatCmd("scripts/tasks/completeWithdraw.ts")
  .then(async (context) => {
    if (!context) return;
    await completeWithdraw(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
