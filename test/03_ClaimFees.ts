import { network } from "hardhat";
import { describe, it } from "node:test";
import { encodeFunctionData } from "viem";

import { readParams } from "../ignition/parameters/utils.js";
import { readLeaf } from "../scripts/createMerkleTree.js";
import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

void describe("03_ClaimFees - Manager with Merkle Verification", function () {
  const PARAMETERS_ID = "localhost-usd";

  async function initialize() {
    const connection = await network.connect();
    const [deployer] = await connection.viem.getWalletClients();

    // Deploy mocks
    const mocks = await deployMocks(connection, PARAMETERS_ID);

    // Mint tokens to deployer
    await mocks.mockERC20.write.mint([deployer.account.address, 10000n * 10n ** 18n]);

    // Deploy full system (vault + accountant + teller + manager)
    const primeModules = await deployPrimeVault(connection, PARAMETERS_ID, {
      stakingToken: mocks.mockERC20.address,
      primeStrategistAddress: mocks.mockStrategist.address,
    });

    // Read updated params with Merkle configuration
    const params = readParams(PARAMETERS_ID);

    return {
      deployer,
      networkHelpers: connection.networkHelpers,
      params,
      ...mocks,
      ...primeModules,
    };
  }

  void describe("Claim Fees", function () {
    void it("Should execute approve and claimFees through Manager with Merkle verification", async function () {
      const { manager, deployer, accountant, mockERC20, teller, networkHelpers, vault } = await initialize();

      // Deposit tokens to generate vault activity
      console.log("\n=== Depositing tokens to vault ===");
      const depositAmount = 1000n * 10n ** 18n;
      await mockERC20.write.approve([vault.address, depositAmount]);
      await teller.write.deposit([depositAmount, 0n, deployer.account.address]);
      console.log("✅ Deposited:", depositAmount.toString());

      // Read leaves with proofs using readLeaf
      const approveData = readLeaf(PARAMETERS_ID, { FunctionSignature: "approve(address,uint256)" });
      const claimFeesData = readLeaf(PARAMETERS_ID, { FunctionSignature: "claimFees()" });

      if (!approveData || !claimFeesData) {
        throw new Error("Required leaves not found in params");
      }

      // Generate some fees by updating exchange rate
      await accountant.write.updateExchangeRate(); // Slight increase
      await networkHelpers.time.increase(2 * 24 * 60 * 60); // 2 days
      await accountant.write.updateExchangeRate(); // Another increase

      // Step 1: Approve accountant to spend base asset (staking token)
      console.log("\n=== Step 1: Approving Accountant to spend base asset ===");

      const approveCalldata = encodeFunctionData({
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [accountant.address, 2n ** 256n - 1n], // Max approval
      });

      // Execute approve through Manager with Merkle proof
      await manager.write.manageVaultWithMerkleVerification([
        [approveData.proof],
        [approveData.leaf.DecoderAndSanitizerAddress],
        [approveData.leaf.TargetAddress as `0x${string}`], // staking token address
        [approveCalldata],
        [0n],
      ]);
      console.log("✅ Approved Accountant to spend base asset");

      // Step 2: Claim fees
      console.log("\n=== Step 2: Claiming fees ===");

      const claimFeesCalldata = encodeFunctionData({
        abi: [
          {
            name: "claimFees",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [],
            outputs: [],
          },
        ],
        functionName: "claimFees",
        args: [],
      });

      // Execute claimFees through Manager with Merkle proof
      await manager.write.manageVaultWithMerkleVerification([
        [claimFeesData.proof],
        [approveData.leaf.DecoderAndSanitizerAddress],
        [claimFeesData.leaf.TargetAddress as `0x${string}`], // accountant address
        [claimFeesCalldata],
        [0n],
      ]);

      console.log("✅ Successfully claimed fees through Manager with Merkle verification!");
    });
  });
});
