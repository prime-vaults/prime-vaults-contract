# Ignition Modules Architecture

## 📦 Module Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     PrimeVaultModule                         │
│              (Main Entry - PrimeFactory.ts)                  │
│  Combines all modules + assigns cross-module roles          │
└─────────────────┬───────────────────────┬───────────────────┘
                  │                       │
        ┌─────────▼─────────┐   ┌────────▼────────┐
        │  WithdrawerModule │   │  ManagerModule  │
        │  (Withdrawer.ts)  │   │  (Manager.ts)   │
        └─────────┬─────────┘   └────────┬────────┘
                  │                      │
        ┌─────────▼─────────┐           │
        │   TellerModule    │           │
        │   (Teller.ts)     │           │
        └─────────┬─────────┘           │
                  │                      │
        ┌─────────▼─────────┐           │
        │ AccountantModule  │           │
        │ (Accountant.ts)   │           │
        └─────────┬─────────┘           │
                  │                      │
        ┌─────────▼─────────────────────▼────────┐
        │           VaultModule                   │
        │           (Vault.ts)                    │
        │   Deploys: BoringVault, RolesAuthority  │
        └─────────┬─────────────────────────────┘
                  │
        ┌─────────▼─────────┐
        │ PrimeRegistryModule│
        │ (PrimeRegistry.ts) │
        │ Base registry layer│
        └────────────────────┘
```

## 🔧 Mock Modules (Testing)

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ MockERC20Module  │  │MockStrategist    │  │ DecoderModule    │
│ (MockERC20.ts)   │  │Module            │  │ (Decoder.ts)     │
│                  │  │(MockStrategist.ts)│  │                  │
│ Test token       │  │Test strategist   │  │Call sanitizer    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## 🎯 Module Responsibilities

### PrimeRegistryModule

- **Deploys**: `PrimeRBAC`, `PrimeRegistry`
- **Purpose**: Global vault registry
- **Dependencies**: None (base layer)

### VaultModule

- **Deploys**: `BoringVault`, `RolesAuthority`
- **Purpose**: Core vault + permissions
- **Dependencies**: PrimeRegistry
- **Permissions Set**:
  - `MANAGER_ROLE` → vault.manage()
  - `MINTER_ROLE` → vault.enter()
  - `BURNER_ROLE` → vault.exit()
  - ETH receive capability

### AccountantModule

- **Deploys**: `AccountantWithYieldStreaming`
- **Purpose**: Exchange rates + fees
- **Dependencies**: Vault
- **Permissions Set**:
  - `MINTER_ROLE` → setFirstDepositTimestamp()
  - `STRATEGIST_ROLE` → updateExchangeRate()
  - `MINTER_ROLE` → updateCumulative()

### TellerModule

- **Deploys**: `TellerWithYieldStreaming`
- **Purpose**: User deposits/withdrawals
- **Dependencies**: Accountant
- **Permissions Set**:
  - `MINTER_ROLE` → deposit(), depositWithPermit()
  - `BURNER_ROLE` → withdraw()
  - `MANAGER_ROLE` → buffer helper config

### WithdrawerModule

- **Deploys**: `DelayedWithdraw`
- **Purpose**: Time-delayed withdrawals
- **Dependencies**: Teller
- **Permissions Set**:
  - Public → requestWithdraw()
  - Public → completeWithdraw()
  - Public → cancelWithdraw()
  - Public → setAllowThirdPartyToComplete()

### ManagerModule

- **Deploys**: `ManagerWithMerkleVerification`
- **Purpose**: Merkle-verified strategies
- **Dependencies**: Vault (parallel to Teller chain)
- **Permissions Set**:
  - `STRATEGIST_ROLE` → manageVaultWithMerkleVerification()
  - `MANAGER_ROLE` assigned to manager contract

### PrimeVaultModule

- **Deploys**: Nothing (orchestrator)
- **Purpose**: Combines all modules + assigns cross-cutting roles
- **Dependencies**: Withdrawer, Manager
- **Roles Assigned**:
  - Accountant: `MINTER_ROLE`, `ADMIN_ROLE`, `STRATEGIST_ROLE`
  - Vault: `BORING_VAULT_ROLE`
  - Teller: `MINTER_ROLE`, `BURNER_ROLE`, `MANAGER_ROLE`, `STRATEGIST_ROLE`
  - Withdrawer: `BURNER_ROLE`

## 📊 Data Flow

```
User Transaction Flow:
─────────────────────

1. Deposit:
   User → Teller → Vault.enter() → Accountant (rate check)

2. Withdraw:
   User → Teller → Vault.exit() → Accountant (rate check)

3. Delayed Withdraw:
   User → Withdrawer.request() → [wait] → Withdrawer.complete() → Vault.exit()

4. Strategy Execution:
   Admin → Manager → Merkle verify → Vault.manage() → External protocol

5. Fee Claims:
   Admin → Manager → Merkle verify → Accountant.claimFees()
```

## 🔐 Permission Matrix

| Contract   | Role            | Can Do                              |
| ---------- | --------------- | ----------------------------------- |
| Vault      | MANAGER_ROLE    | manage()                            |
| Vault      | MINTER_ROLE     | enter()                             |
| Vault      | BURNER_ROLE     | exit()                              |
| Accountant | MINTER_ROLE     | setFirstDepositTimestamp()          |
| Accountant | STRATEGIST_ROLE | updateExchangeRate()                |
| Accountant | ADMIN_ROLE      | Admin functions                     |
| Teller     | MINTER_ROLE     | deposit(), depositWithPermit()      |
| Teller     | BURNER_ROLE     | withdraw()                          |
| Teller     | MANAGER_ROLE    | Configure buffer helpers            |
| Withdrawer | PUBLIC          | request/complete/cancel             |
| Manager    | STRATEGIST_ROLE | manageVaultWithMerkleVerification() |

## 📝 Deployment Order

**Required Order:**

1. PrimeRegistry (base)
2. Vault (needs Registry)
3. Accountant (needs Vault)
4. Teller (needs Accountant)
5. Withdrawer (needs Teller)
6. Manager (needs Vault - can deploy in parallel with Teller chain)
7. PrimeVault (needs all - assigns final roles)

**Parallel Possible:**

- Manager can deploy in parallel with Accountant/Teller/Withdrawer
- Mock modules can deploy anytime before PrimeVault

## 🧪 Testing Pattern

```typescript
// 1. Deploy mocks
const { mockERC20, mockStrategist, decoder } = await deployMocks(connection, "localhost-usd");

// 2. Deploy vault system
const { vault, accountant, teller, withdrawer, manager, ... } =
  await deployPrimeVault(connection, "localhost-usd", {
    stakingToken: mockERC20.address,
    primeStrategistAddress: mockStrategist.address
  });

// 3. Use in tests
await teller.write.deposit([mockERC20.address, amount, minShares]);
```

## 💡 Key Design Decisions

1. **Module Independence**: Each module can be deployed separately
2. **Clear Dependencies**: Explicit import chain prevents circular deps
3. **Role Assignment Split**:
   - Basic roles set in each module
   - Cross-cutting roles set in PrimeVault
4. **Parallel Deployment**: Manager separate from Teller chain
5. **Mock Separation**: Test modules clearly separated
6. **ID Prefixing**: All calls have descriptive IDs for debugging

## 🔄 Future Extensions

To add a new module:

1. Create `NewModule.ts` in `ignition/modules/`
2. Import dependencies: `import XxxModule from "./Xxx.js"`
3. Add JSDoc comment
4. Deploy contracts
5. Set permissions
6. Export in `index.ts`
7. Add to PrimeVault if needed
8. Document in README

Example:

```typescript
/**
 * New Feature Module
 * Deploys XYZ for ABC functionality
 */
export default buildModule("NewFeatureModule", (m) => {
  const { vault, rolesAuthority } = m.useModule(VaultModule);

  const newContract = m.contract("NewContract", [vault]);
  m.call(newContract, "setAuthority", [rolesAuthority], { id: "new_setAuthority" });

  return { newContract, vault, rolesAuthority };
});
```
