# BoringVault

## Overview

**BoringVault** is a secure, share-based ERC20 vault that holds user assets and executes DeFi strategies through role-gated permissions. It acts as the core
custody and accounting layer in the vault system.

## Core Concept

BoringVault implements a simple but powerful pattern:

- Users deposit **assets** (e.g., USDC, WETH) and receive **shares** (ERC20 vault tokens)
- Share price is calculated externally by the Accountant contract
- Authorized managers can execute arbitrary DeFi strategies using the vault's assets
- Users burn shares to withdraw their proportional assets

```
User → Deposit Assets → Receive Shares → Vault Executes Strategies → Burn Shares → Withdraw Assets
```

## Architecture

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ deposit/withdraw
       ↓
┌──────────────────┐
│     Teller       │ ← Handles user interactions
└──────┬───────────┘
       │ enter()/exit()
       ↓
┌──────────────────┐
│  BoringVault     │ ← Custody + Share accounting
└──────┬───────────┘
       │ manage()
       ↓
┌──────────────────┐
│ DeFi Protocols   │ ← Aave, Uniswap, etc.
└──────────────────┘

Access Control:
RolesAuthority ← PrimeAuth ← BoringVault
```

## Role System

BoringVault uses a granular role-based access control system via `RolesAuthority`:

| Role               | Functions                  | Purpose                         | Typical Holder                              |
| ------------------ | -------------------------- | ------------------------------- | ------------------------------------------- |
| **MINTER**         | `enter()`                  | Mint shares when users deposit  | Teller contract                             |
| **BURNER**         | `exit()`                   | Burn shares when users withdraw | Teller contract                             |
| **MANAGER**        | `manage()`, `bulkManage()` | Execute DeFi strategies         | Manager contract (with Merkle verification) |
| **PROTOCOL_ADMIN** | `setBeforeUpdateHook()`    | Configure optional hooks        | Protocol multisig                           |

## Key Functions

### 1. `enter()` - Deposit & Mint

```solidity
function enter(address from, uint256 assetAmount, address to, uint256 shareAmount)
```

**Purpose**: Mint vault shares when users deposit assets

**Flow**:

1. Transfer `assetAmount` of underlying asset from `from` to vault
2. Call `beforeUpdateHook` if configured (e.g., update reward tracking)
3. Mint `shareAmount` of vault shares to `to`

**Access**: MINTER_ROLE only (typically Teller)

**Note**: Share amount is calculated by the caller (Teller), not by BoringVault

### 2. `exit()` - Burn & Withdraw

```solidity
function exit(address to, uint256 assetAmount, address from, uint256 shareAmount)
```

**Purpose**: Burn vault shares when users withdraw assets

**Flow**:

1. Call `beforeUpdateHook` if configured
2. Burn `shareAmount` of vault shares from `from`
3. Transfer `assetAmount` of underlying asset to `to`

**Access**: BURNER_ROLE only (typically Teller)

### 3. `manage()` - Execute Strategy

```solidity
function manage(address target, bytes calldata data, uint256 value)
```

**Purpose**: Execute arbitrary external call to DeFi protocols

**Examples**:

- Deposit assets to Aave lending pool
- Swap tokens on Uniswap
- Stake tokens in yield farms
- Claim protocol fees from Accountant

**Access**: MANAGER_ROLE only

**Security**: All calls must be validated by a Decoder/Sanitizer contract via Merkle proof verification. This prevents unauthorized actions like:

- Transferring assets to arbitrary addresses
- Calling dangerous functions
- Manipulating vault permissions

### 4. `bulkManage()` - Batch Execution

```solidity
function bulkManage(address[] calldata targets, bytes[] calldata data, uint256[] calldata values)
```

**Purpose**: Execute multiple strategy calls atomically

**Use Cases**:

- Complex multi-step strategies (withdraw from protocol A, swap, deposit to protocol B)
- Gas optimization (one transaction instead of many)

**Access**: MANAGER_ROLE only

**Atomicity**: All calls must succeed or the entire transaction reverts

## Hook System (Optional)

BoringVault supports an optional `beforeUpdateHook` that is called **before** any balance change (mint/burn/transfer).

### Purpose

Enable external contracts to track user balances for reward distribution, analytics, or custom logic.

### Common Use Case: Distributor

The Distributor contract uses this hook to:

1. Update reward snapshots before balance changes
2. Track user share balances over time
3. Calculate proportional reward distribution

### Hook Flow

```
enter/exit/transfer
  ↓
_callBeforeUpdate()
  ↓
beforeUpdateHook.beforeUpdate(from, to, amount, operator)
  ↓
Actual balance change (mint/burn/transfer)
```

### Configuration

```solidity
// Enable hook (Protocol Admin only)
vault.setBeforeUpdateHook(address(distributorContract));

// Disable hook
vault.setBeforeUpdateHook(address(0));
```

## Deployment (Hardhat Ignition)

The `Vault.ts` module deploys BoringVault with proper permissions in a sequential manner:

### Deployment Steps

1. **Deploy RolesAuthority**
   - RBAC system for the vault
   - Deployer is set as owner

2. **Deploy BoringVault**
   - Pass RolesAuthority address
   - Set vault name, symbol, and underlying asset

3. **Configure Role Capabilities** (sequential)
   - Grant MANAGER role permission to call `manage()`
   - Grant MANAGER role permission to call `bulkManage()`
   - Grant MINTER role permission to call `enter()`
   - Grant BURNER role permission to call `exit()`

4. **Assign Vault Role**
   - Grant BORING_VAULT role to the vault contract itself

### Why Sequential Execution?

Each `m.call()` uses the `after` parameter to ensure proper execution order. This prevents race conditions and ensures the vault is fully configured before use.

## Security Model

### Trust Assumptions

1. **MANAGER**: Trusted to execute profitable strategies that benefit vault users
2. **Decoder/Sanitizer**: Trusted to whitelist only safe DeFi protocols and functions
3. **Accountant**: Trusted to calculate accurate share prices
4. **Hook Contract**: Trusted to not revert maliciously and block legitimate transactions

### Attack Vectors & Mitigations

| Attack Vector                | Mitigation                                                     |
| ---------------------------- | -------------------------------------------------------------- |
| Unauthorized asset transfers | All `manage()` calls validated by Merkle-proof decoder         |
| Price manipulation           | Share price calculated by external Accountant with rate limits |
| Reentrancy during strategies | Hook system allows defensive tracking before state changes     |
| Role escalation              | RolesAuthority prevents self-modification of permissions       |
| Griefing via hook            | Protocol admin can disable hook at any time                    |

### Critical Invariants

1. **Share Conservation**: Total shares minted = Total shares in circulation + Total shares burned
2. **Asset Backing**: Vault always has enough assets to satisfy withdrawals (enforced by Teller withdrawal queue)
3. **Role Isolation**: Only authorized roles can call privileged functions
4. **Hook Safety**: Hook failures cause transaction revert (no silent failures)

## Integration Example

### Basic Deposit & Withdraw Flow

```solidity
// 1. User approves Teller
asset.approve(address(teller), 100e18);

// 2. Teller calculates shares and calls vault.enter()
uint256 shares = teller.previewDeposit(100e18);
vault.enter(user, 100e18, user, shares);

// 3. Manager executes strategy via manage()
vault.manage(
    aavePool,
    abi.encodeCall(IPool.deposit, (asset, 50e18, vault, 0)),
    0
);

// 4. User requests withdrawal
teller.requestWithdraw(shares, user);

// 5. After delay, withdrawal is completed
// Teller calls vault.exit()
vault.exit(user, 100e18, user, shares);
```

### Fee Claiming Flow (from Test)

```solidity
// 1. Accountant accumulates platform fees over time
accountant.updateExchangeRate(); // Accrues fees

// 2. Vault approves Accountant to spend base asset
manager.manageVaultWithMerkleVerification(
    [proof],
    [decoderAddress],
    [assetAddress],
    [approveCalldata], // approve(accountant, max)
    [0]
);

// 3. Claim fees via manage()
manager.manageVaultWithMerkleVerification(
    [proof],
    [decoderAddress],
    [accountantAddress],
    [claimFeesCalldata], // claimFees()
    [0]
);

// Result: Fees transferred from vault to payout address
```

## Related Contracts

- **PrimeAuth**: Base authentication layer (extends Solmate's Auth + PrimeRBAC integration)
- **RolesAuthority**: Solmate's battle-tested RBAC system
- **TellerWithBuffer**: User-facing contract for deposits/withdrawals
- **ManagerWithMerkleVerification**: Secure strategy execution with allowlist
- **AccountantWithRateProviders**: Share price calculation and fee accrual
- **Distributor** (optional): Reward distribution based on share balances
- **FullDecoderAndSanitizer**: Validates all `manage()` calls against allowlist

## Files

- **Contract**: `contracts/core/BoringVault.sol`
- **Deployment**: `ignition/modules/vault/Vault.ts`
- **Tests**: `test/01_Deposit.ts`, `test/03_Withdraw.ts`, `test/04_ClaimFees.ts`
