import fs from "fs";
import { network } from "hardhat";
import { describe, it } from "node:test";
import path from "path";
import { encodeFunctionData } from "viem";

import MockERC20Module from "../ignition/modules/MockERC20.js";
import PrimeFactoryModule from "../ignition/modules/PrimeFactory.js";
import { findLeaf, generateMerkleTree, getProof } from "../scripts/createMerkleTree.js";

void describe("03_ClaimFees - Manager with Merkle Verification", function () {
  const parameters = path.resolve(import.meta.dirname, `../ignition/parameters/localhost-usd.json`);

  async function initialize() {
    const { ignition, viem, ...rest } = await network.connect();
    const [deployer] = await viem.getWalletClients();

    // Read params file to get Merkle root and leaves
    const paramsFile = fs.readFileSync(parameters, "utf-8");
    const params = JSON.parse(paramsFile);
    const managerModule = params.ManagerModule;

    // Deploy MockERC20
    const { mockERC20 } = await ignition.deploy(MockERC20Module, { parameters });

    // Mint tokens to deployer
    await mockERC20.write.mint([deployer.account.address, 10000n * 10n ** 18n]);

    // Deploy full system (vault + accountant + teller + manager)
    const primeModules = await ignition.deploy(PrimeFactoryModule, { parameters, displayUi: true });

    return {
      viem,
      deployer,
      mockERC20,
      params, // Return full params for findLeaf
      managerModule,
      ...primeModules,
      ...rest,
    };
  }

  void describe("Claim Fees", function () {
    void it("Should execute claimFees through Manager with Merkle verification", async function () {
      const {
        manager,
        rawDataDecoder,
        deployer,
        accountant,
        mockERC20,
        vault,
        teller,
        networkHelpers,
        params,
        managerModule,
      } = await initialize();

      // Deposit tokens to generate vault activity
      const depositAmount = 1000n * 10n ** 18n;
      await mockERC20.write.approve([vault.address, depositAmount]);
      await teller.write.deposit([depositAmount, 0n, deployer.account.address]);

      // Read Merkle root and leaves from params
      const merkleRoot = managerModule.ManageRoot as `0x${string}`;
      const leaves = managerModule.leafs;

      console.log("\n=== Merkle Configuration from JSON ===");
      console.log("Root:", merkleRoot);
      console.log("Total leaves:", leaves.length);
      leaves.forEach((leaf: any, idx: number) => {
        console.log(`\nLeaf ${idx}: ${leaf.Description}`);
        console.log(`  Digest: ${leaf.LeafDigest}`);
      });

      // Find leaves using findLeaf function
      const claimFeesResult = findLeaf(params, "claimFees()");
      const approveResult = findLeaf(params, "approve(address,uint256)");

      if (!claimFeesResult || !approveResult) {
        throw new Error("Required leaves not found in params. Run: npx tsx scripts/createMerkleTree.ts localhost-usd");
      }

      const { leaf: claimFeesLeaf, index: claimFeesIndex } = claimFeesResult;
      const { leaf: approveLeaf, index: approveIndex } = approveResult;

      console.log("\n=== Found Leaves ===");
      console.log(`ClaimFees: index ${claimFeesIndex}, target ${claimFeesLeaf.TargetAddress}`);
      console.log(`Approve: index ${approveIndex}, target ${approveLeaf.TargetAddress}`);

      // Build tree to get proofs
      const leafDigests = leaves.map((l: any) => l.LeafDigest as `0x${string}`);
      const tree = generateMerkleTree(leafDigests);

      // Get proofs using indices from findLeaf
      const claimFeesProof = getProof(claimFeesIndex, tree);
      const approveProof = getProof(approveIndex, tree);

      console.log("\n=== Merkle Proofs ===");
      console.log(`Approve proof (${approveProof.length} nodes):`, approveProof);
      console.log(`ClaimFees proof (${claimFeesProof.length} nodes):`, claimFeesProof);

      // Set Merkle root for strategist
      await manager.write.setManageRoot([deployer.account.address, merkleRoot]);

      // Prepare claimFees calldata
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

      // Execute through Manager with proper proof
      await accountant.write.updateExchangeRate();
      await networkHelpers.time.increase(1 * 24 * 60 * 60); // Increase time by 1 day
      await accountant.write.updateExchangeRate();

      // Step 1: Approve accountant to spend vault shares
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

      console.log("\nStep 1: Vault approving accountant to spend base asset...");

      // Use target from JSON config
      const approveTarget = approveLeaf.TargetAddress as `0x${string}`;

      await manager.write.manageVaultWithMerkleVerification([
        [approveProof],
        [rawDataDecoder.address],
        [approveTarget], // Use target from JSON (should be vault for vault shares approval)
        [approveCalldata],
        [0n],
      ]);

      console.log("✅ Approved accountant");

      // Step 2: Claim fees
      console.log("\nStep 2: Claiming fees...");
      await manager.write.manageVaultWithMerkleVerification([
        [claimFeesProof], // Real Merkle proof from multi-leaf tree
        [rawDataDecoder.address],
        [accountant.address],
        [claimFeesCalldata],
        [0n],
      ]);

      console.log("✅ Successfully claimed fees through Manager!");
    });
  });
});
