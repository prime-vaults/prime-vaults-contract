import hre from "hardhat";

import DelayedWithdrawModule from "../../ignition/modules/DelayedWithdraw.js";

export default async function main() {
  const connection = await hre.network.connect();

  // You need to provide actual deployed addresses
  const parameters = {
    owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // First hardhat account
    boringVault: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Replace with actual
    accountant: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // Replace with actual
    feeAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Can be different
  };

  console.log("Deploying DelayedWithdraw with parameters:", parameters);

  const { delayedWithdraw } = await connection.ignition.deploy(DelayedWithdrawModule, {
    displayUi: true,
    parameters: {
      DelayedWithdraw: parameters,
    },
  });

  console.log("✅ DelayedWithdraw deployed to:", delayedWithdraw.address);

  return { delayedWithdraw };
}

main().catch(console.error);
