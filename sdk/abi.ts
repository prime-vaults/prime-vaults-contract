import AccountantJson from "../artifacts/contracts/core/AccountantWithYieldStreaming.sol/AccountantWithYieldStreaming.json";
import type { AccountantWithYieldStreaming$Type } from "../artifacts/contracts/core/AccountantWithYieldStreaming.sol/artifacts.d.ts";
import BoringVaultJson from "../artifacts/contracts/core/BoringVault.sol/BoringVault.json";
import type { BoringVault$Type } from "../artifacts/contracts/core/BoringVault.sol/artifacts.d.ts";
import WithdrawerJson from "../artifacts/contracts/core/DelayedWithdraw.sol/DelayedWithdraw.json";
import type { DelayedWithdraw$Type } from "../artifacts/contracts/core/DelayedWithdraw.sol/artifacts.d.ts";
import TellerJson from "../artifacts/contracts/core/TellerWithMultiAssetSupport.sol/TellerWithMultiAssetSupport.json";
import type { TellerWithMultiAssetSupport$Type } from "../artifacts/contracts/core/TellerWithMultiAssetSupport.sol/artifacts.d.ts";

export type AccountantType = AccountantWithYieldStreaming$Type;
export type BoringVaultType = BoringVault$Type;
export type TellerType = TellerWithMultiAssetSupport$Type;
export type WithdrawerType = DelayedWithdraw$Type;

export const AccountantAbi = AccountantJson as AccountantWithYieldStreaming$Type;
export const BoringVaultAbi = BoringVaultJson as BoringVault$Type;
export const TellerAbi = TellerJson as TellerWithMultiAssetSupport$Type;
export const WithdrawerAbi = WithdrawerJson as DelayedWithdraw$Type;
