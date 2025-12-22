import bepoliaBtc from "../ignition/parameters/bepolia-btc.json";
import bepoliaUsd from "../ignition/parameters/bepolia-usd.json";
import localhostUsd from "../ignition/parameters/default-usd.json";
import { generateMerkleTree, getProof } from "../scripts/createMerkleTree.js";

export interface GlobalConfig {
  chainId: number;
  network: string;
  adminAddress: `0x${string}`;
  stakingToken: `0x${string}`;
  PrimeRBAC: `0x${string}`;
  PrimeStrategistAddress: `0x${string}`;
  DecoderAndSanitizerAddress: `0x${string}`;
  //
  BoringVaultAddress: `0x${string}`;
  AccountantAddress: `0x${string}`;
  TellerAddress: `0x${string}`;
  WithdrawerAddress: `0x${string}`;
  RolesAuthorityAddress: `0x${string}`;
  DistributorAddress: `0x${string}`;
  ManagerAddress: `0x${string}`;
  PrimeTimelockAddress: `0x${string}`;
}

export interface LeafConfig {
  Description: string;
  FunctionSignature: string;
  FunctionSelector: `0x${string}`;
  DecoderAndSanitizerAddress: `0x${string}`;
  TargetAddress: `0x${string}`;
  CanSendValue: boolean;
  AddressArguments: `0x${string}`[];
  PackedArgumentAddresses: string;
  LeafDigest: `0x${string}`;
}

export interface VaultParameters {
  $global: GlobalConfig;
  VaultModule: {
    name: string;
    symbol: string;
  };
  ManagerModule: {
    manageRoot: `0x${string}`;
    leafs: Array<LeafConfig>;
  };
  [key: string]: any;
}

export const BepoliaVaultUsd = bepoliaUsd as unknown as VaultParameters;
export const BepoliaVaultBtc = bepoliaBtc as unknown as VaultParameters;
export const LocalhostVaultUsd = localhostUsd as unknown as VaultParameters;

export function getLeaf(params: VaultParameters, description: string) {
  const leaves = params.ManagerModule?.leafs;

  const index = leaves.findIndex((l) => l.Description === description);

  if (index === -1) return undefined;
  const leaf = leaves[index];
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
