import bepoliaUsd from "../ignition/parameters/bepolia-usd.json";
import localhostUsd from "../ignition/parameters/localhost-usd.json";

export interface GlobalConfig {
  chainId: number;
  network: string;
  adminAddress: `0x${string}`;
  stakingToken: `0x${string}`;
  PrimeRBAC: `0x${string}`;
  PrimeStrategistAddress: `0x${string}`;
  DecoderAndSanitizerAddress: `0x${string}`;
  PrimeRegistryAddress: `0x${string}`;
  //
  BoringVaultAddress: `0x${string}`;
  AccountantAddress: `0x${string}`;
  TellerAddress: `0x${string}`;
  WithdrawerAddress: `0x${string}`;
  RolesAuthorityAddress: `0x${string}`;
  DistributorAddress: `0x${string}`;
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
export const LocalhostVaultUsd = localhostUsd as unknown as VaultParameters;
