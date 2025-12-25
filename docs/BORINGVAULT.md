# BoringVault - Core Vault Contract

## Purpose

**BoringVault** is the core vault contract of the Prime Vaults system, serving as both **asset custody** and **share ledger**. This contract holds all user
assets and issues corresponding ERC20 shares.

## Role in Ecosystem

BoringVault is the **central hub** of the system:

- **Asset custody**: All tokens (USDC, WETH, etc.) deposited into the vault are stored here
- **Share issuance**: Mint/burn ERC20 shares representing asset ownership
- **Strategy execution**: Allows Manager to call DeFi protocols (Aave, Uniswap, etc.) for yield generation
- **Hook support**: Integrates with Distributor to automatically update rewards when balances change

## Core Functions

### 1. Deposit & Withdrawal (Mint/Burn Shares)

```solidity
function enter(address from, uint256 assetAmount, address to, uint256 shareAmount)
function exit(address to, uint256 assetAmount, address from, uint256 shareAmount)
```

- **enter**: Receives asset from user, mints shares (MINTER_ROLE only)
- **exit**: Burns shares, returns asset to user (BURNER_ROLE only)
- **Hook integration**: Automatically calls `beforeUpdateHook` before balance changes

### 2. Strategy Execution (Asset Management)

```solidity
function manage(address target, bytes calldata data, uint256 value)
function bulkManage(address[] calldata targets, bytes[] calldata data, uint256[] calldata values)
```

- **Purpose**: Allows strategist to deploy assets into DeFi protocols
- **Examples**:
  - Deposit USDC into Aave to earn interest
  - Swap tokens on Uniswap
  - Stake ETH in Lido
- **Security**: MANAGER_ROLE only, must verify through ManagerWithMerkleVerification

### 3. Transfer Hooks

```solidity
function transfer(address to, uint256 amount)
function transferFrom(address from, address to, uint256 amount)
```

- Overrides ERC20 transfer to call `beforeUpdateHook`
- Used to update rewards in Distributor before balance changes

## Roles & Permissions

| Role               | Permission                            | Granted To              |
| ------------------ | ------------------------------------- | ----------------------- |
| **MINTER_ROLE**    | Mint shares (call `enter`)            | Teller contract         |
| **BURNER_ROLE**    | Burn shares (call `exit`)             | Teller, DelayedWithdraw |
| **MANAGER_ROLE**   | Call `manage()` to interact with DeFi | Manager contract        |
| **PROTOCOL_ADMIN** | Set `beforeUpdateHook`                | Protocol owner          |
| **OWNER_ROLE**     | Set `beforeUpdateHook`                | Protocol owner          |

## Contract Interactions

### 1. **Teller** (Minter/Burner)

```
User deposit → Teller → vault.enter() → Mint shares
User withdraw → Teller → vault.exit() → Burn shares
```

### 2. **Manager** (Manager Role)

```
Strategist → Manager.manageVaultWithMerkleVerification()
          → vault.manage() → Call DeFi protocol
```

### 3. **Distributor** (BeforeUpdateHook)

```
vault.transfer() → beforeUpdateHook.beforeUpdate()
                → Distributor updates rewards
                → Transfer executes
```

### 4. **DelayedWithdraw** (Burner)

```
User complete withdrawal → DelayedWithdraw.completeWithdraw()
                        → vault.exit() → Burn shares + transfer assets
```

## Technical Specifications

- **ERC20 compliant**: Shares are freely transferable (unless locked)
- **Multi-token support**: Can hold ERC20, ERC721, ERC1155 tokens
- **Decimal matching**: Share decimals = asset decimals (USDC: 6, WETH: 18)
- **Reentrancy protection**: Not required (only trusted contracts can call)

## Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                   BoringVault                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │   Assets   │  │   Shares   │  │  Manage()  │    │
│  │ (USDC/ETH) │  │  (ERC20)   │  │   calls    │    │
│  └────────────┘  └────────────┘  └────────────┘    │
└─────────────────────────────────────────────────────┘
         ▲              ▲                ▲
         │              │                │
    ┌────┴────┐    ┌───┴────┐      ┌───┴────────┐
    │ Teller  │    │Distrib │      │  Manager   │
    │(deposit)│    │(rewards)│      │(strategy)  │
    └─────────┘    └────────┘      └────────────┘
```

## Important Notes

1. **No exchange rate management**: Share pricing is handled by Accountant
2. **No slippage checks**: Teller and DelayedWithdraw are responsible for minimum output validation
3. **Immutable asset**: Asset address cannot change after deployment
4. **Total supply invariant**: Manager must ensure totalSupply doesn't change during management
5. **Hook dependency**: Transfers may fail if Distributor contract has errors
