/**
 * Prime Vaults Ignition Modules
 * Export all deployment modules for easy importing
 */

// Core modules
export { default as PrimeRegistryModule } from "./PrimeRegistry.js";
export { default as VaultModule } from "./Vault.js";
export { default as AccountantModule } from "./Accountant.js";
export { default as TellerModule } from "./Teller.js";
export { default as WithdrawerModule } from "./Withdrawer.js";
export { default as ManagerModule } from "./Manager.js";

// Main factory module
export { default as PrimeVaultModule } from "./PrimeFactory.js";

// Mock/testing modules
export { default as MockERC20Module } from "./MockERC20.js";
export { default as MockStrategistModule } from "./MockStrategist.js";
export { default as DecoderModule } from "./Decoder.js";
