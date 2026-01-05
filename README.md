<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.30-363636?logo=solidity&logoColor=white" alt="Solidity">
  <img src="https://img.shields.io/badge/Hardhat-2.x-yellow?logo=ethereum&logoColor=white" alt="Hardhat">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Security-Audited-brightgreen" alt="Audited">
</p>

<h1 align="center">
  <br>
  🏦 Prime Vaults
  <br>
</h1>

<p align="center">
  <strong>A Modular Multi-Chain DeFi Vault System</strong>
  <br>
  <em>Deposit assets • Earn yield • Execute cross-chain strategies</em>
</p>

<p align="center">
  <a href="#-architecture">Architecture</a> •
  <a href="#-primevault-core">PrimeVault</a> •
  <a href="#-primestrategy">PrimeStrategy</a> •
  <a href="#-primeexecutor">PrimeExecutor</a> •
  <a href="#-deployments">Deployments</a> •
  <a href="#-getting-started">Getting Started</a>
</p>

---

## 📖 Overview

**Prime Vaults** is a sophisticated DeFi infrastructure built on the **BoringVault architecture** that enables users to:

- 🔒 **Deposit assets** and receive ERC20 vault shares
- 💰 **Earn passive income** through automated DeFi strategies
- 🌐 **Cross-chain execution** via bridge integrations (Stargate, LiFi)
- 🎁 **Multi-token rewards** with automatic distribution

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRIME VAULTS ECOSYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   👤 USER (Any Chain)                                                       │
│      │                                                                      │
│      ▼                                                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     🌉 PRIMEEXECUTOR (Bridge Layer)                  │  │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│   │  │    Stargate     │  │      LiFi       │  │   LayerZero     │       │  │
│   │  │    Bridge       │  │     Bridge      │  │   Messaging     │       │  │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│             │                                                               │
│             ▼         Cross-chain transfer to Native Chain                  │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    📱 SMART ACCOUNT (User Wallet)                    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│             │                                                               │
│             ▼                                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      🏦 PRIMEVAULT (Core Vault)                      │  │
│   │  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐               │  │
│   │  │BoringVault  │◄──┤ Accountant   │◄──┤   Teller     │◄── Deposit    │  │
│   │  │(ERC20 Vault)│   │(Rates & Fees)│   │ (Gateway)    │               │  │
│   │  └──────┬──────┘   └──────────────┘   └──────────────┘               │  │
│   │         │                                                            │  │
│   │  ┌──────▼──────┐   ┌──────────────┐   ┌──────────────┐               │  │
│   │  │  Manager    │   │DelayedWithdraw│   │ Distributor  │── Rewards    │  │
│   │  │ (Merkle)    │   │ (Time-lock)  │   │  (Multi-tok) │               │  │
│   │  └──────┬──────┘   └──────────────┘   └──────────────┘               │  │
│   └─────────┼────────────────────────────────────────────────────────────┘  │
│             │                                                               │
│             ▼                                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      ⚡ PRIMESTRATEGY (Yield)                         │  │
│   │         Deploy vault assets to DeFi protocols for yield              │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                🔐 ACCESS CONTROL (PrimeRBAC)                         │  │
│   │     OWNER_ROLE  │  PROTOCOL_ADMIN_ROLE  │  OPERATOR_ROLE             │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏦 PrimeVault (Core)

The core vault system manages asset custody, share issuance, and yield generation.

### Components

| Component           | Description                           | Key Features                                         |
| ------------------- | ------------------------------------- | ---------------------------------------------------- |
| **BoringVault**     | Minimal ERC20 vault (~100 lines)      | Asset custody, share minting/burning, DeFi execution |
| **Accountant**      | Exchange rate & fee manager           | Time-based fee accrual, rate calculations            |
| **Teller**          | User gateway for deposits/withdrawals | Slippage protection, deposit caps                    |
| **DelayedWithdraw** | Time-locked withdrawal security       | 3-day delay, expedited option with fee               |
| **Distributor**     | Multi-token reward distribution       | Automatic accrual, compounding support               |
| **Manager**         | Merkle-verified strategy executor     | Whitelist all DeFi operations                        |

### Key Formulas

```
📊 Exchange Rate:
   shareValue = (totalAssets - feesOwed) / totalShares

💰 Platform Fee (Annual):
   fees = (shares × rate × platformFee × timeDelta) / (10000 × 365 days)

🎁 Rewards per Token:
   rewardPerToken = stored + ((now - lastUpdate) × rate × 1e27) / totalSupply
```

### User Flows

<details>
<summary><b>📥 Deposit Flow</b></summary>

```
1. User approves Teller to spend tokens
2. User calls deposit(amount, minimumShares)
3. Accountant updates exchange rate
4. Teller calculates shares = amount / rate
5. Vault mints shares (locked for 1 day)
6. User starts earning rewards automatically
```

</details>

<details>
<summary><b>📤 Withdrawal Flow (Delayed)</b></summary>

```
1. User calls requestWithdraw(shares)
2. Shares transferred to DelayedWithdraw contract
3. Request locked for 3 days (or pay 2% for 1-day)
4. After maturity, user calls completeWithdraw()
5. Vault burns shares and transfers assets
```

</details>

---

## ⚡ PrimeStrategy

Strategy execution module for deploying vault assets across DeFi protocols (Aave, Compound, Uniswap, Curve, etc.). Supports both single-asset and pair-asset
allocations with Merkle-verified operations.

---

## 🌉 PrimeExecutor

Cross-chain bridge executor for moving assets between supported chains. Integrates with **Stargate** (LayerZero) and **LiFi** aggregator for optimal routing and
execution.

---

## 📍 Deployments

### Mainnet Contracts

<details>
<summary><b>🐻 Berachain (Chain ID: 80094)</b></summary>

#### pUSD Vault

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| BoringVault     | `0x8596cD23aa747Fd867235D422F3C4896A5A6Bb24` |
| Accountant      | `0xa2d2085504c3e7C83e8E37b33Df50709c00f2bBB` |
| Teller          | `0xC59b0CE194Bf8b202f21C03F6F9F394eEf10d1CF` |
| Distributor     | `0x5429F08D515f65681418145A367046712D4adDa2` |
| DelayedWithdraw | `0xFE609D66BC15b409b8F657cA0F78c95031C7D26c` |
| Manager         | `0x1E526f3255458Dd0a38D1F018eda7518A4A6a8E2` |

#### pBTC Vault

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| BoringVault     | `0x5a4C11645E58E732092494db0dBb57B0646CDa1d` |
| Accountant      | `0xd7300E0C572AEd4251dED65C70c74d2c7732197A` |
| Teller          | `0x87E842c626a4c14C60B2acE6293400a4000Df4be` |
| Distributor     | `0xbf84E1cBc598952536F62Da3F6F39dF786C95bef` |
| DelayedWithdraw | `0x540E06c68366aA3f79D700b7d82c69cEabDB9990` |
| Manager         | `0xb47197d81604f3058BdDd993372a14a36183a11f` |

#### Shared Infrastructure

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| PrimeRBAC           | `0xe4d53b98e09FdAb10aFaB99393AD0ffbe37dD446` |
| PrimeTimelock       | `0x8C256f131D86b7301106F943221f749157B1FeF3` |
| PrimeExecutor       | `0xf9e8D18003590E06334E8C70cE6dD0B480462ec5` |
| DecoderAndSanitizer | `0x7178182Fd96148B4E72b2b1e93292b0A493A7fB4` |
| PrimeStrategist     | `0xcfDB218585d77BeD370781D9C5eF40CeFa634427` |

</details>

<details>
<summary><b>🔶 BNB Smart Chain (Chain ID: 56)</b></summary>

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |

</details>

<details>
<summary><b>🔷 Ethereum (Chain ID: 1)</b></summary>

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |

</details>

<details>
<summary><b>🔵 Arbitrum (Chain ID: 42161)</b></summary>

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |

</details>

<details>
<summary><b>🟠 CoreDAO (Chain ID: 1116)</b></summary>

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| PrimeExecutor | `0xb2f865041e3F7De4576FB5B30ac8e9fbDA82e29d` |

</details>

---

## 🔐 Security

### Security Features

| Feature                    | Description                                        |
| -------------------------- | -------------------------------------------------- |
| 🔒 **Share Locks**         | 1-day lock on deposits prevents flash loan attacks |
| ⏱️ **Withdrawal Delays**   | 3-day delay allows emergency response              |
| 🌳 **Merkle Verification** | All DeFi operations must be pre-approved           |
| ⏸️ **Pause Mechanism**     | Emergency pause for all critical contracts         |
| 🛡️ **Reentrancy Guards**   | Protection against callback exploits               |
| 📊 **Supply Invariants**   | Prevents share dilution attacks                    |

### Audits

| Auditor            | Date          | Report                                                                                                                   |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Salus Security** | December 2025 | [View Report](https://github.com/Salusec/Salus-audit/blob/main/2025/Prime-vault_audit_report_2025-12-22.pdf)             |
| **Shieldify**      | December 2025 | [View Report](https://github.com/shieldify-security/audits-portfolio/blob/main/reports/Prime-Vaults-Security-Review.pdf) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.16.0
- pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/prime-vaults/prime-vaults-contract.git
cd prime-vaults-contract

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
```

### Commands

```bash
# Compile contracts
pnpm compile

# Run tests
pnpm test

# Deploy
pnpm hardhat ignition deploy --network <network>

# Check contract sizes
pnpm contract-size

# Lint
pnpm lint:sol
pnpm lint:ts
```

### Networks

```bash
# Testnets
pnpm hardhat ignition deploy --network bepolia
pnpm hardhat ignition deploy --network sepolia
pnpm hardhat ignition deploy --network bscTestnet
pnpm hardhat ignition deploy --network arbitrumSepolia

# Mainnets
pnpm hardhat ignition deploy --network berachain
pnpm hardhat ignition deploy --network mainnet
pnpm hardhat ignition deploy --network bsc
pnpm hardhat ignition deploy --network arbitrum
pnpm hardhat ignition deploy --network coreDao
```

---

## 📁 Project Structure

```
contracts/
├── 🏦 core/                    # Core vault components
│   ├── BoringVault.sol         # ERC20 vault & asset custody
│   ├── AccountantProviders.sol # Exchange rates & fees
│   ├── Teller.sol              # Deposit/withdraw gateway
│   ├── DelayedWithdraw.sol     # Time-locked withdrawals
│   ├── Distributor.sol         # Multi-token rewards
│   └── ManagerWithMerkle...    # Strategy execution
│
├── ⚡ strategy/                 # Strategy management
│   ├── PrimeStrategy.sol       # Strategy orchestration
│   └── ...
│
├── 🌉 executor/                 # Cross-chain bridges
│   ├── BaseBridgeExecutor.sol  # Shared bridge logic
│   ├── StargateBridgeExec...   # Stargate integration
│   └── LiFiBridgeExecutor.sol  # LiFi integration
│
├── 🔐 auth/                     # Access control
│   ├── PrimeRBAC.sol           # Role-based permissions
│   ├── PrimeAuth.sol           # Contract authentication
│   └── RolesAuthority.sol      # Solmate roles
│
├── 🔍 decodersAndSanitizers/    # Transaction validation
│   └── ...
│
└── 📚 interfaces/               # Contract interfaces
    └── ...
```

---

## 📚 Documentation

| Document                               | Description               |
| -------------------------------------- | ------------------------- |
| [Architecture](./docs/ARCHITECTURE.md) | Detailed system design    |
| [Security](./docs/SECURITY.md)         | Security best practices   |
| [Timelock](./docs/TIMELOCK.md)         | Governance timelock setup |
| [Cross-chain](./docs/CROSSCHAIN.md)    | Bridge integration guide  |
| [Audit Report](./docs/AUDIT.md)        | Security audit findings   |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>Prime Vaults</strong>
  <br>
  <em>Building the future of cross-chain DeFi</em>
  <br><br>
  <a href="https://primevaults.finance">Website</a> •
  <a href="https://docs.primevaults.finance">Docs</a> •
  <a href="https://x.com/PrimeVaultsHQ">X</a> •
</p>
