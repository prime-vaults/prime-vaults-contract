import localhostUsd from "../ignition/parameters/localhost-usd.json";

export interface VaultParameters {
  $global: {
    chainId: number;
    network: string;
    stakingToken: string;
    adminAddress: string;
    PrimeStrategistAddress: string;
    DecoderAndSanitizerAddress: string;
    PrimeRegistryAddress: string;
    PrimeRBAC: string;
    BoringVaultAddress: string;
    AccountantAddress: string;
    TellerAddress: string;
    WithdrawerAddress: string;
    RolesAuthorityAddress: string;
  };
  VaultModule: {
    name: string;
    symbol: string;
  };
  AccountantModule: {
    startingExchangeRate: string;
    allowedExchangeRateChangeUpper: number;
    allowedExchangeRateChangeLower: number;
    minimumUpdateDelayInSeconds: number;
    platformFee: number;
    performanceFee: number;
  };
  WithdrawerModule: {
    withdrawDelayInSeconds: number;
    withdrawFee: number;
  };
  ManagerModule: {
    manageRoot: string;
    leafs: Array<{
      Description: string;
      FunctionSignature: string;
      FunctionSelector: string;
      DecoderAndSanitizerAddress: string;
      TargetAddress: string;
      CanSendValue: boolean;
      AddressArguments: string[];
      PackedArgumentAddresses: string;
      LeafDigest: string;
    }>;
  };
}

export const parameters = {
  localhostUsd: localhostUsd as VaultParameters,
} as const;

export type ParameterKey = keyof typeof parameters;
