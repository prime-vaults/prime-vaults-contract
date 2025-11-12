# Ignition Deployment Modules

This directory contains Hardhat Ignition modules for deploying the Prime Vaults system.

## 📁 Module Structure

### Core Modules (Production)

1. **PrimeRegistry.ts**
   - Deploys: `PrimeRBAC`, `PrimeRegistry`
   - Purpose: Registry for tracking all vault deployments
   - Dependencies: None

2. **Vault.ts**
   - Deploys: `BoringVault`, `RolesAuthority`
   - Purpose: Core vault contract with role-based permissions
   - Dependencies: PrimeRegistry

3. **Accountant.ts**
   - Deploys: `AccountantWithYieldStreaming`
   - Purpose: Exchange rate and fee management
   - Dependencies: Vault

4. **Teller.ts**
   - Deploys: `TellerWithYieldStreaming`
   - Purpose: User deposits and withdrawals
   - Dependencies: Accountant

5. **Withdrawer.ts**
   - Deploys: `DelayedWithdraw`
   - Purpose: Time-delayed withdrawal queue
   - Dependencies: Teller

6. **Manager.ts**
   - Deploys: `ManagerWithMerkleVerification`
   - Purpose: Merkle-verified strategy execution
   - Dependencies: Vault (independent of Teller chain)

7. **PrimeFactory.ts** (Main Entry Point)
   - Combines all modules and assigns roles
   - Use this for full vault deployment
   - Dependencies: Withdrawer, Manager

### Mock Modules (Testing)

1. **MockERC20.ts**
   - Deploys: `MockERC20`
   - Purpose: Test token for local development

2. **MockStrategist.ts**
   - Deploys: `MockStrategist`
   - Purpose: Mock strategy contract for testing

3. **Decoder.ts**
   - Deploys: `FullDecoderAndSanitizer`
   - Purpose: Validates and sanitizes strategy calls

## 🔄 Deployment Flow

```
PrimeRegistry (base)
    ↓
Vault + RolesAuthority
    ↓
Accountant
    ↓
Teller
    ↓
Withdrawer

Manager (parallel to Vault)
    ↓
PrimeFactory (combines all + assigns roles)
```

## 🚀 Usage

### Deploy Full System

```typescript
import PrimeVaultModule from "./ignition/modules/PrimeFactory.js";

const modules = await ignition.deploy(PrimeVaultModule, {
  parameters: "./ignition/parameters/localhost-usd.json",
});
```

### Deploy Individual Module

```typescript
import VaultModule from "./ignition/modules/Vault.js";

const { vault, rolesAuthority } = await ignition.deploy(VaultModule, {
  parameters: { ... },
});
```

### Deploy Mocks

```typescript
import { MockERC20Module, MockStrategistModule } from "./ignition/modules/index.js";

const { mockERC20 } = await ignition.deploy(MockERC20Module);
const { mockStrategist } = await ignition.deploy(MockStrategistModule);
```

## 📋 Module Checklist

Each module follows this structure:

✅ Clear JSDoc comment describing purpose  
✅ Proper module dependencies with `m.useModule()`  
✅ Descriptive `id` for all contract calls  
✅ Consistent naming: `XxxModule` for module names  
✅ Returns all deployed contracts

## 🔧 Parameters

Modules read parameters from JSON files in `ignition/parameters/`:

- `$global`: Shared across all modules
- `VaultModule`: Vault-specific config
- `AccountantModule`: Accountant-specific config
- `WithdrawerModule`: Withdrawer-specific config

See `ignition/parameters/localhost-usd.json` for example structure.

## 🧪 Testing

Test scripts should use the deploy helpers:

```typescript
import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

// Deploy mocks
const mocks = await deployMocks(connection, "localhost-usd");

// Deploy vault
const vault = await deployPrimeVault(connection, "localhost-usd", {
  stakingToken: mocks.mockERC20.address,
  primeStrategistAddress: mocks.mockStrategist.address,
});
```

## 📝 Notes

- Module names ending with "Module" (e.g., `VaultModule`) are exported constants
- File names match module names (e.g., `Vault.ts` exports `VaultModule`)
- All modules are re-exported in `index.ts` for convenient importing
- Commented code has been removed for clarity
- Each module is independent and can be deployed separately
