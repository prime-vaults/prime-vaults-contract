import { NetworkConnection } from "hardhat/types/network";
import { zeroAddress } from "viem";

import { readParams } from "../../ignition/parameters/utils.js";
import { runHardhatCmd } from "../utils.js";

/**
 * Deploy Prime Vault system
 * Deploys: Distributor
 */
export default async function deposit(connection: NetworkConnection, parameterId: string) {
  // Update parameters with required addresses
  const parameters = readParams(parameterId);

  const stakingToken = await connection.viem.getContractAt("MockERC20", parameters.$global.stakingToken);
  const teller = await connection.viem.getContractAt("TellerWithMultiAssetSupport", parameters.$global.TellerAddress);

  const decimals = await stakingToken.read.decimals();
  const depositAmount = 10n ** BigInt(decimals) / 1000n; // 0.001 token

  const txApprove = await stakingToken.write.approve([parameters.$global.BoringVaultAddress, depositAmount]);
  await (await connection.viem.getPublicClient()).waitForTransactionReceipt({ hash: txApprove });
  const txDeposit = await teller.write.deposit([depositAmount, 0n, zeroAddress]);
  console.log(`Deposit transaction hash: ${txDeposit}`);
}

// pnpm hardhat run scripts/tasks/deposit.ts --network <network>
runHardhatCmd("scripts/tasks/deposit.ts")
  .then(async (context) => {
    if (!context) return;
    await deposit(context.connection, context.parameters);
  })
  .catch((error) => {
    console.error(error);
  });
