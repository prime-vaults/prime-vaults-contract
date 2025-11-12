import { concat, keccak256, toFunctionSelector } from "viem";

import { type LeafConfig, type ParamsJson, readParams, writeParams } from "../ignition/parameters/utils.js";

/**
 * Generate leaf digest from leaf configuration
 */
function generateLeafDigest(leaf: LeafConfig): `0x${string}` {
  const selector = toFunctionSelector(leaf.FunctionSignature);
  const valueNonZero = leaf.CanSendValue ? "0x01" : "0x00";

  // Pack addresses (20 bytes each, not padded)
  const packedAddresses = leaf.AddressArguments.map((addr) => addr.replace(/0x/gi, "").toLowerCase()).join("");

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
 * const params = readParams("localhost-usd");
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
  // Read from $metadata (new location) or fallback to ManagerModule (backward compatibility)
  const leaves = params.$metadata?.leafs || params.ManagerModule?.leafs;
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
 * Read leaf with proof from params file
 * Returns leaf configuration, index, proof, and tree for Merkle verification
 *
 * @param paramsId - Params file ID (e.g., "localhost-usd")
 * @param filters - Filters to find the leaf
 * @returns Leaf data with proof and tree, or undefined if not found
 *
 * @example
 * ```typescript
 * // Find by function signature
 * const approveData = readLeaf("localhost-usd", { FunctionSignature: "approve(address,uint256)" });
 * if (approveData) {
 *   console.log("Leaf:", approveData.leaf);
 *   console.log("Index:", approveData.index);
 *   console.log("Proof:", approveData.proof);
 * }
 *
 * // Find by description
 * const claimFeesData = readLeaf("localhost-usd", { Description: "Claim platform fees from Accountant" });
 * ```
 */
export function readLeaf(
  paramsId: string,
  filters: { FunctionSignature?: string; Description?: string },
): { leaf: LeafConfig; index: number; proof: `0x${string}`[]; tree: `0x${string}`[][] } | undefined {
  const params = readParams(paramsId);

  // Read from $metadata (new location) or fallback to ManagerModule (backward compatibility)
  const leaves = params.$metadata?.leafs || params.ManagerModule?.leafs;

  if (!leaves) return undefined;

  // Find leaf by filters
  const index = leaves.findIndex((l) => {
    if (filters.FunctionSignature && l.FunctionSignature !== filters.FunctionSignature) {
      return false;
    }
    if (filters.Description && l.Description !== filters.Description) {
      return false;
    }
    return true;
  });

  if (index === -1) return undefined;

  const leaf = leaves[index];

  // Build tree and get proof
  const leafDigests = leaves.map((l: any) => l.LeafDigest as `0x${string}`);
  const tree = generateMerkleTree(leafDigests);
  const proof = getProof(index, tree);

  return {
    leaf,
    index,
    proof,
    tree,
  };
}

/**
 * Create Merkle tree from params file
 * Auto-generates approve and claimFees leaves based on $metadata addresses
 *
 * @param paramsId - Params file ID (e.g., "localhost-usd")
 */
export function createMerkleTree(paramsId: string) {
  console.log(`\n📄 Reading params from: ${paramsId}`);

  // Read params using utility
  const params = readParams(paramsId);

  if (!params.$metadata) {
    throw new Error("$metadata not found in params file - need deployed contract addresses");
  }

  const { AccountantAddress } = params.$metadata;
  const { DecoderAndSanitizerAddress, stakingToken, PrimeStrategistAddress } = params.$global;

  // Create leaves array automatically
  const leaves: LeafConfig[] = [];

  // Leaf 0: approve(address,uint256) - Approve Accountant
  leaves.push({
    Description: "Approve Accountant to spend base asset (staking token)",
    FunctionSignature: "approve(address,uint256)",
    FunctionSelector: toFunctionSelector("approve(address,uint256)"),
    DecoderAndSanitizerAddress,
    TargetAddress: stakingToken,
    CanSendValue: false,
    AddressArguments: [AccountantAddress],
    PackedArgumentAddresses: "0x",
    LeafDigest: "0x",
  });

  // Leaf 1: approve(address,uint256) - Approve PrimeStrategist
  leaves.push({
    Description: "Approve PrimeStrategist to spend base asset (staking token)",
    FunctionSignature: "approve(address,uint256)",
    FunctionSelector: toFunctionSelector("approve(address,uint256)"),
    DecoderAndSanitizerAddress,
    TargetAddress: stakingToken,
    CanSendValue: false,
    AddressArguments: [PrimeStrategistAddress],
    PackedArgumentAddresses: "0x",
    LeafDigest: "0x",
  });

  // Leaf 2: claimFees() - Claim platform fees from Accountant
  leaves.push({
    Description: "Claim platform fees from Accountant",
    FunctionSignature: "claimFees()",
    FunctionSelector: toFunctionSelector("claimFees()"),
    DecoderAndSanitizerAddress,
    TargetAddress: AccountantAddress,
    CanSendValue: false,
    AddressArguments: [],
    PackedArgumentAddresses: "0x",
    LeafDigest: "0x",
  });

  console.log(`\n🌳 Building Merkle tree with ${leaves.length} leaves...\n`);

  // Process each leaf and generate digest
  const leafDigests: `0x${string}`[] = [];

  leaves.forEach((leaf) => {
    // Pack addresses for display and hashing
    const packedAddresses = leaf.AddressArguments.map((addr) => addr.replace(/0x/gi, "").toLowerCase()).join("");
    leaf.PackedArgumentAddresses = packedAddresses;

    // Generate leaf digest
    const digest = generateLeafDigest(leaf);
    leaf.LeafDigest = digest;
    leafDigests.push(digest);
  });

  // Build Merkle tree
  const tree = generateMerkleTree(leafDigests);
  const root = tree[tree.length - 1][0];

  console.log(`\n✅ Merkle Root: ${root}`);
  console.log(`   Tree Levels: ${tree.length}`);

  // Update params - store in $metadata instead of ManagerModule
  params.$metadata.ManageRoot = root;
  params.$metadata.leafs = leaves;

  // Write updated params back to file using utility
  writeParams(paramsId, params);

  console.log(`\n💾 Updated params file: ${paramsId}`);
  console.log(`   - ManageRoot: ${root}`);
  console.log(`   - Generated ${leaves.length} leaf configurations`);

  return { ManageRoot: root, leafs: leaves };
}

// CLI execution
// npx tsx scripts/createMerkleTree.ts localhost-usd
if (import.meta.url === `file://${process.argv[1]}`) {
  const paramsPath = process.argv[2];
  if (!paramsPath) throw new Error("Please provide the params file path as an argument");
  createMerkleTree(paramsPath);
}
