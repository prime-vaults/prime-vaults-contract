import bepoliaBtc from "../ignition/parameters/bepolia-btc.json" with { type: "json" };
import bepoliaUsd from "../ignition/parameters/bepolia-usd.json" with { type: "json" };
import berachainBtc from "../ignition/parameters/berachain-btc.json" with { type: "json" };
import berachainEth from "../ignition/parameters/berachain-eth.json" with { type: "json" };
import berachainUsd from "../ignition/parameters/berachain-usd.json" with { type: "json" };
import berachainWBera from "../ignition/parameters/berachain-wbera.json" with { type: "json" };
import { generateMerkleTree, getProof } from "../scripts/createMerkleTree.js";

export interface GlobalConfig {
  chainId: number;
  network: string;
  adminAddress: `0x${string}`;
  stakingToken: `0x${string}`;
  PrimeRBAC: `0x${string}`;
  PrimeStrategistAddress: `0x${string}`;
  DecoderAndSanitizerAddress: `0x${string}`;
  SmartAccountRegistryAddress: `0x${string}`;
  //
  BoringVaultAddress: `0x${string}`;
  AccountantAddress: `0x${string}`;
  TellerAddress: `0x${string}`;
  WithdrawerAddress: `0x${string}`;
  RolesAuthorityAddress: `0x${string}`;
  DistributorAddress: `0x${string}`;
  ManagerAddress: `0x${string}`;
  PrimeTimeLockAddress: `0x${string}`;
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

// ========================================= VAULT REGISTRY =========================================
export const BepoliaVaultUsd = bepoliaUsd as unknown as VaultParameters;
export const BepoliaVaultBtc = bepoliaBtc as unknown as VaultParameters;
export const BerachainVaultUsd = berachainUsd as unknown as VaultParameters;
export const BerachainVaultBtc = berachainBtc as unknown as VaultParameters;
export const BerachainVaultEth = berachainEth as unknown as VaultParameters;
export const BerachainVaultWBera = berachainWBera as unknown as VaultParameters;

/**
 * Registry of all available vaults across different chains
 */
const VAULT_REGISTRY: VaultParameters[] = [BepoliaVaultUsd, BepoliaVaultBtc, BerachainVaultUsd, BerachainVaultBtc, BerachainVaultEth, BerachainVaultWBera];

/**
 * Get all vaults for a specific chain ID
 * @param chainId The chain ID to filter by
 * @returns Array of vault parameters for the specified chain
 */
export function getVaultsByChainId(chainId: number): VaultParameters[] {
  return VAULT_REGISTRY.filter((vault) => vault.$global.chainId === chainId);
}

/**
 * Get a specific vault by its address
 * @param vaultAddress The BoringVault contract address
 * @returns Vault parameters if found, undefined otherwise
 */
export function getVault(vaultAddress: `0x${string}`): VaultParameters {
  const vault = VAULT_REGISTRY.find((vault) => vault.$global.BoringVaultAddress.toLowerCase() === vaultAddress.toLowerCase());
  if (!vault) throw new Error(`Vault with address ${vaultAddress} not found.`);
  return vault;
}

export function getVaultChainId(vaultAddress: `0x${string}`): number {
  const vault = getVault(vaultAddress);
  if (!vault) throw new Error(`Vault with address ${vaultAddress} not found.`);
  return vault?.$global.chainId;
}

/**
 * Get vaults that use a specific asset as staking token
 * @param assetAddress The asset/staking token address
 * @param chainId Optional chain ID to filter results
 * @returns Array of vault parameters using the specified asset
 */
export function getVaultsByAsset(assetAddress: `0x${string}`, chainId?: number): VaultParameters[] {
  let vaults = VAULT_REGISTRY.filter((vault) => vault.$global.stakingToken.toLowerCase() === assetAddress.toLowerCase());

  if (chainId !== undefined) {
    vaults = vaults.filter((vault) => vault.$global.chainId === chainId);
  }

  return vaults;
}
