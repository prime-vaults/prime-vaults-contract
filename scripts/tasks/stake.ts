// import { network } from "hardhat";

// import deployStaking from "../deploy/01_vaultUSD.js";

// async function main() {
//   const { viem } = await network.connect();
//   const publicClient = await viem.getPublicClient();
//   const [senderClient] = await viem.getWalletClients();

//   const { mockERC20, staking } = await deployStaking();
//   const txMint = await mockERC20.write.mint([senderClient.account.address, 100n], {
//     account: senderClient.account,
//   });
//   await publicClient.waitForTransactionReceipt({ hash: txMint });

//   const txApprove = await mockERC20.write.approve([staking.address, 100n], {
//     account: senderClient.account,
//   });
//   await publicClient.waitForTransactionReceipt({ hash: txApprove });

//   const txStake = await staking.write.stake([100n], {
//     account: senderClient.account,
//   });
//   const receipt = await publicClient.waitForTransactionReceipt({ hash: txStake });
//   console.log(`Transaction stake: ${receipt.transactionHash}`);
// }

// main().catch(console.error);
