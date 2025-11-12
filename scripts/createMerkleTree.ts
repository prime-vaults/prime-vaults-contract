import fs from "fs";
import path from "path";
import { concat, keccak256, toFunctionSelector } from "viem";

interface LeafConfig {
  Description: string;
  FunctionSignature: string;
  FunctionSelector: string;
  DecoderAndSanitizerAddress: string;
  TargetAddress: string;
  CanSendValue: boolean;
  AddressArguments: string[];
  PackedArgumentAddresses: string;
  LeafDigest: string;
}

interface ManagerModule {
  ManageRoot: string;
  leafs: LeafConfig[];
}

interface ParamsJson {
  ManagerModule: ManagerModule;
  [key: string]: any;
}

/**
 * Generate Merkle tree from leaves
 * @param leaves - Array of leaf hashes
 * @returns Multi-level tree array
 */
export function generateMerkleTree(leaves: `0x${string}`[]): `0x${string}`[][] {
  if (leaves.length === 0) {
    throw new Error("Cannot generate Merkle tree with no leaves");
  }

  const tree: `0x${string}`[][] = [leaves];

  while (tree[tree.length - 1].length > 1) {
    const currentLevel = tree[tree.length - 1];
    const nextLevel: `0x${string}`[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Hash pair
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        const hash = left < right ? keccak256(concat([left, right])) : keccak256(concat([right, left]));
        nextLevel.push(hash);
      } else {
        // Odd number of nodes, promote the last one
        nextLevel.push(currentLevel[i]);
      }
    }

    tree.push(nextLevel);
  }

  return tree;
}

/**
 * Get Merkle proof for a specific leaf
 * @param leafIndex - Index of the leaf in the tree
 * @param tree - The Merkle tree
 * @returns Array of sibling hashes forming the proof
 */
export function getProof(leafIndex: number, tree: `0x${string}`[][]): `0x${string}`[] {
  const proof: `0x${string}`[] = [];
  let index = leafIndex;

  for (let level = 0; level < tree.length - 1; level++) {
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;

    if (siblingIndex < tree[level].length) {
      proof.push(tree[level][siblingIndex]);
    }

    index = Math.floor(index / 2);
  }

  return proof;
}

/**
 * Find a leaf in the params by function signature and optionally target address
 *
 * @param params - The params object from JSON
 * @param functionSignature - The function signature to search for (e.g., "claimFees()")
 * @param target - Optional target address to match
 * @returns The matching leaf and its index, or undefined if not found
 *
 * @example
 * ```typescript
 * const params = JSON.parse(fs.readFileSync("ignition/parameters/localhost-usd.json", "utf-8"));
 *
 * // Find by function signature only
 * const result = findLeaf(params, "claimFees()");
 * if (result) {
 *   console.log(`Found at index ${result.index}`);
 *   console.log(`Target: ${result.leaf.TargetAddress}`);
 * }
 *
 * // Find by function signature and target
 * const accountantAddr = "0x9A676e781A523b5d0C0e43731313A708CB607508";
 * const result2 = findLeaf(params, "claimFees()", accountantAddr);
 * ```
 */
export function findLeaf(
  params: ParamsJson,
  functionSignature: string,
  target?: string,
): { leaf: LeafConfig; index: number } | undefined {
  const leaves = params.ManagerModule?.leafs;
  if (!leaves) return undefined;

  const index = leaves.findIndex((l) => {
    const signatureMatches = l.FunctionSignature === functionSignature;
    if (!target) return signatureMatches;

    // Normalize addresses for comparison (case-insensitive)
    const targetMatches = l.TargetAddress?.toLowerCase() === target.toLowerCase();
    return signatureMatches && targetMatches;
  });

  if (index === -1) return undefined;

  return {
    leaf: leaves[index],
    index,
  };
}

/**
 * Generate leaf digest from leaf configuration
 */
function generateLeafDigest(leaf: LeafConfig): `0x${string}` {
  const selector = toFunctionSelector(leaf.FunctionSignature);
  const valueNonZero = leaf.CanSendValue ? "0x01" : "0x00";

  // Pack addresses (20 bytes each, not padded)
  const packedAddresses = leaf.AddressArguments.join("").replace(/0x/g, "");

  const leafDigest = keccak256(
    concat([
      leaf.DecoderAndSanitizerAddress as `0x${string}`,
      leaf.TargetAddress as `0x${string}`,
      valueNonZero as `0x${string}`,
      selector,
      `0x${packedAddresses}` as `0x${string}`,
    ]),
  );

  return leafDigest;
}

/**
 * Create Merkle tree from params file
 * @param paramsPath - Path to JSON params file (e.g., "localhost-usd")
 */
export function createMerkleTree(paramsPath: string): void {
  // Resolve params file path
  const paramsFile = path.resolve(process.cwd(), `ignition/parameters/${paramsPath.replace(".json", "")}.json`);

  if (!fs.existsSync(paramsFile)) {
    throw new Error(`Params file not found: ${paramsFile}`);
  }

  console.log(`\n📄 Reading params from: ${paramsFile}`);

  // Read and parse JSON
  const params: ParamsJson = JSON.parse(fs.readFileSync(paramsFile, "utf-8"));

  if (!params.ManagerModule || !params.ManagerModule.leafs) {
    throw new Error("ManagerModule or leafs not found in params file");
  }

  // Add claimFees leaf if not exists
  const hasClaimFeesLeaf = params.ManagerModule.leafs.some(
    (leaf) => leaf.FunctionSignature === "claimFees()" || leaf.Description.toLowerCase().includes("claim fee"),
  );

  if (!hasClaimFeesLeaf && params.$global?.AccountantAddress) {
    console.log("\n➕ Adding claimFees() leaf...");
    params.ManagerModule.leafs.push({
      Description: "Claim platform fees from Accountant",
      FunctionSignature: "claimFees()",
      FunctionSelector: "",
      DecoderAndSanitizerAddress: params.$global.DecoderAndSanitizerAddress || "",
      TargetAddress: params.$global.AccountantAddress,
      CanSendValue: false,
      AddressArguments: [],
      PackedArgumentAddresses: "",
      LeafDigest: "",
    });
  }

  console.log(`\n🌳 Building Merkle tree with ${params.ManagerModule.leafs.length} leaves...\n`);

  // Process each leaf and generate digest
  const leafDigests: `0x${string}`[] = [];

  params.ManagerModule.leafs.forEach((leaf, index) => {
    // Generate function selector
    const selector = toFunctionSelector(leaf.FunctionSignature);
    leaf.FunctionSelector = selector;

    // Pack addresses
    const packedAddresses = leaf.AddressArguments.map((addr) => addr.replace(/0x/gi, "").toLowerCase()).join("");
    leaf.PackedArgumentAddresses = packedAddresses ? `0x${packedAddresses}` : "";

    // Generate leaf digest
    const digest = generateLeafDigest(leaf);
    leaf.LeafDigest = digest;
    leafDigests.push(digest);

    console.log(`Leaf ${index}: ${leaf.Description}`);
    console.log(`  Function: ${leaf.FunctionSignature}`);
    console.log(`  Selector: ${selector}`);
    console.log(`  Target: ${leaf.TargetAddress}`);
    console.log(`  Decoder: ${leaf.DecoderAndSanitizerAddress}`);
    console.log(`  Can Send Value: ${leaf.CanSendValue}`);
    console.log(`  Address Args: [${leaf.AddressArguments.join(", ")}]`);
    console.log(`  Packed Addresses: ${leaf.PackedArgumentAddresses || "(none)"}`);
    console.log(`  Leaf Digest: ${digest}\n`);
  });

  // Build Merkle tree
  const tree = generateMerkleTree(leafDigests);
  const root = tree[tree.length - 1][0];

  console.log(`\n✅ Merkle Root: ${root}`);
  console.log(`   Tree Levels: ${tree.length}`);

  // Update ManageRoot in params
  params.ManagerModule.ManageRoot = root;

  // Write updated params back to file
  fs.writeFileSync(paramsFile, JSON.stringify(params, null, 2) + "\n");

  console.log(`\n💾 Updated params file: ${paramsFile}`);
  console.log(`   - ManageRoot: ${root}`);
  console.log(`   - Updated ${params.ManagerModule.leafs.length} leaf configurations`);

  // Display Merkle tree structure
  console.log("\n🌲 Merkle Tree Structure:");
  tree.forEach((level, idx) => {
    console.log(`   Level ${idx}: ${level.length} node(s)`);
    if (idx === 0) {
      level.forEach((node, nodeIdx) => {
        console.log(`      [${nodeIdx}] ${node} - ${params.ManagerModule.leafs[nodeIdx]?.Description || "Unknown"}`);
      });
    }
  });

  // Display proofs for each leaf
  console.log("\n📋 Merkle Proofs:");
  params.ManagerModule.leafs.forEach((leaf, idx) => {
    const proof = getProof(idx, tree);
    console.log(`\n   Leaf ${idx}: ${leaf.Description}`);
    console.log(`   Digest: ${leaf.LeafDigest}`);
    console.log(`   Proof (${proof.length} nodes):`);
    proof.forEach((p, pIdx) => {
      console.log(`      [${pIdx}] ${p}`);
    });
  });

  console.log("\n✨ Done!\n");
}

// CLI execution
// npx tsx scripts/createMerkleTree.ts localhost-usd
if (import.meta.url === `file://${process.argv[1]}`) {
  const paramsPath = process.argv[2];
  if (!paramsPath) throw new Error("Please provide the params file path as an argument");
  createMerkleTree(paramsPath);
}
