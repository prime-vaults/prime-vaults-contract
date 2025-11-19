# PrimeVault Strategy

PrimeVault Strategy is the investment execution layer of the PrimeVault system on Berachain.  
It manages how deposited assets are allocated into modular, upgradeable strategies — while ensuring
users can always withdraw their principal safely.

This repository contains the unified strategy interfaces, registry interfaces, and supporting data structures
used by VaultCore and all strategy implementations.

---

## 🔧 Architecture OverviewUser Deposit

PrimeVault Staking → VaultCore → Strategy Contracts (Single / Pair) → Treasury (harvest)

### Components

| Component                                                     | Role                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **IStrategyBase / ISingleAssetStrategy / IPairAssetStrategy** | Defines required functions every strategy must implement               |
| **IVaultRegistry (VaultRegister)**                            | Stores, activates, deactivates strategy addresses                      |
| **IVaultManager**                                             | Manages Treasury address receiving all harvested rewards               |
| **VaultCore**                                                 | Allocates assets into registered strategies using the structs provided |

---

## 🧩 Strategy Types

PrimeVault supports two strategy kinds:

### **1. Single Asset Strategy (`SingleAsset`)**

Handles a **single token** such as:

- USDC
- WETH
- WBTC

Typical use cases:

- Lending
- Single-token staking
- Yield vaults

### **2. Pair Asset Strategy (`PairAsset`)**

Manages **two tokens** and usually interacts with:

- LP pools
- AMM liquidity provisioning

---

## 📜 Strategy Interfaces

### **IStrategyBase**

All strategies must define:

- The owning `vault()`
- The strategy type `kind()`

### **ISingleAssetStrategy**

Implements:

- `deposit(token, amount)`
- `withdraw(token, amount)`
- `withdrawAll(token)`
- `harvest(token)`

### **IPairAssetStrategy**

Implements:

- `deposit(tokenA, amountA, tokenB, amountB)`
- `withdrawByAmounts(...)`
- `withdrawAll(tokenA, tokenB)`
- `harvest(tokenA, tokenB)`

Each `harvest()` sends reward **directly to Treasury** configured in VaultManager.

---

## 🏛️ Vault Registry (`IVaultRegistry`)

The Registry ensures safety by controlling:

- Which strategy addresses are allowed
- Whether a strategy is active
- Which strategy kind they belong to

VaultCore **cannot allocate funds** to strategies that are not:

1. Registered
2. Active

This prevents misallocation or malicious strategy usage.

---

## 💰 Treasury Management (`IVaultManager`)

`IVaultManager`:

- Holds the address of the Treasury receiving all strategy rewards
- Allows admin/governance to update Treasury safely
- Ensures harvested tokens never stay inside strategies or VaultCore

---

## 📦 Data Structures

The repository also includes:

- Single & pair allocation structs
- Withdrawal priority model
- Swap params
- Error definitions
- Event definitions

These are primarily used in `VaultCore`.

---

## 🔐 Security Design

- Curator **never holds funds** — only calls allocation.
- Strategies **never hold user principal after withdraw**.
- Treasury is always the endpoint for all rewards.
- VaultCore ensures:
  - Registered strategy
  - Correct strategy kind
  - Sufficient idle balance
  - Replay-safe withdrawals
- Strategy contracts must revert with proper error codes.

---

## 📄 License

MIT License

---

## 📬 Contact

For questions or integration support:  
**PrimeVault Engineering Team**
