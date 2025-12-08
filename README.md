# Prime Vaults

A modular DeFi vault system enabling users to deposit assets, receive vault shares, and earn passive income through automated strategy execution and multi-reward distribution.

## Overview

Prime Vaults is built on the **BoringVault architecture** and provides:

- **Strategy Execution** - Automated DeFi operations (lending, farming, swaps)
- **Multi-Reward Distribution** - Automatic reward accrual to share holders
- **Time-Locked Withdrawals** - Security protection against flash attacks
- **Platform Fees** - Time-based fee accrual with transparent accounting

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRIME VAULTS ECOSYSTEM                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │BoringVault  │◄─────┤ Accountant   │◄─────┤ Teller       │   │
│  │(ERC20 Vault)│      │(Rates & Fees)│      │(Gateway)     │   │
│  └──────┬──────┘      └──────────────┘      └──────────────┘   │
│         │                                                        │
│         │                                                        │
│  ┌──────▼──────┐      ┌──────────────┐      ┌──────────────┐   │
│  │ Manager     │      │DelayedWithdraw│     │ Distributor  │   │
│  │(Strategy)   │      │(Time-lock)    │     │(Rewards)     │   │
│  └─────────────┘      └──────────────┘      └──────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           PrimeRBAC (Role-Based Access Control)           │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **BoringVault** | Asset custody & ERC20 shares | [Details](./BORINGVAULT_README.md) |
| **Accountant** | Exchange rates & platform fees | [Details](./ACCOUNTANT_README.md) |
| **Teller** | Deposit/withdrawal gateway | [Details](./TELLER_README.md) |
| **Manager** | Strategy execution | [Details](./MANAGER_README.md) |
| **DelayedWithdraw** | Time-locked withdrawals | [Details](./DELAYEDWITHDRAW_README.md) |
| **Distributor** | Multi-token rewards | [Details](./DISTRIBUTOR_README.md) |

---

## Key Concepts

### ERC20 Vault Shares

Users deposit assets (USDC, WBTC, etc.) and receive proportional ERC20 vault shares. Share value appreciates as the vault generates yield through DeFi strategies.

**Exchange Rate Formula:**
```
shareValue = (totalAssets - feesOwed) / totalShares
```

### Merkle-Verified Strategies

All vault operations (Aave deposits, Uniswap swaps, etc.) must be pre-approved via Merkle tree verification. This whitelist approach prevents unauthorized asset movements.

### Promise-Based Rewards

The Distributor uses a promise-based model where admins notify reward amounts first, then deposit tokens later. This improves capital efficiency while tracking reward debt.

### Time-Locked Security

Deposits are share-locked for 1 day to prevent flash loan attacks. Withdrawals require a 3-day delay (or pay expedited fee) to allow emergency response time.

---

## User Flows

### Deposit Flow

1. User approves asset transfer to Teller
2. Teller calls Accountant to get current exchange rate
3. Teller calculates shares to mint (asset amount / rate)
4. Vault mints shares to user (locked for 1 day)
5. User automatically starts earning rewards

### Withdrawal Flow

1. User requests withdrawal via DelayedWithdraw
2. Current exchange rate is locked for the request
3. After 3-day maturity, user completes withdrawal
4. Vault burns shares and transfers assets to user

### Strategy Execution Flow

1. Admin generates Merkle proof for desired operation
2. Manager verifies proof against stored root
3. Decoder validates and sanitizes transaction data
4. Vault executes operation (e.g., Aave deposit)
5. Total supply invariant check ensures no share dilution

---

## Deployment

### Berachain Testnet (bepolia)

Deployment artifacts available in:
- `ignition/deployments/bepolia-usd/`
- `ignition/deployments/bepolia-btc/`

---

## Role-Based Access Control

**Key Roles:**
- `PUBLIC` - User deposits/withdrawals
- `SOLVER_ROLE` - Bulk operations (market makers)
- `MINTER_ROLE` / `BURNER_ROLE` - Share minting/burning
- `MANAGER_ROLE` - Strategy execution
- `UPDATE_EXCHANGE_RATE_ROLE` - Rate updates
- `ADMIN_ROLE` - Pause & configuration

See component documentation for detailed permission matrices.

---

## Contract Structure

```
contracts/
├── core/
│   ├── BoringVault.sol
│   ├── AccountantWithRateProviders.sol
│   ├── AccountantWithYieldStreaming.sol
│   ├── TellerWithMultiAssetSupport.sol
│   ├── TellerWithYieldStreaming.sol
│   ├── TellerWithBuffer.sol
│   ├── ManagerWithMerkleVerification.sol
│   ├── DelayedWithdraw.sol
│   ├── Distributor.sol
│   ├── PrimeBufferHelper.sol
│   └── PrimeRegistry.sol
│
├── auth/
│   ├── PrimeAuth.sol
│   ├── PrimeRBAC.sol
│   └── RolesAuthority.sol
│
├── decodersAndSanitizers/
│   ├── BaseDecoderAndSanitizer.sol
│   ├── FullDecoderAndSanitizer.sol
│   └── PrimeDecoderAndSanitizer.sol
│
├── strategy/
│   ├── VaultCore.sol
│   ├── VaultManager.sol
│   └── VaultRegister.sol
│
├── helper/
│   ├── Error.sol
│   ├── MockERC20.sol
│   └── MockStrategist.sol
│
└── interfaces/
    ├── IBaseVault.sol
    ├── IBufferHelper.sol
    ├── IDistributor.sol
    ├── IPausable.sol
    ├── IPrimeRBAC.sol
    ├── IPrimeRegistry.sol
    ├── IRateProvider.sol
    ├── IStrategy.sol
    └── IVaultCore.sol
```

---

## Development

### Prerequisites

- Node.js >= 18.16.0
- pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/Beraji-Labs/prime-vaults-contract.git
cd prime-vaults-contract

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

### Commands

```bash
# Compile contracts
pnpm compile

# Run tests
pnpm test

# Deploy to localhost (requires hardhat node running)
pnpm test-local

# Check contract sizes
pnpm contract-size

# Lint Solidity
pnpm lint:sol

# Lint TypeScript
pnpm lint:ts

# Fix linting issues
pnpm lint:fix

# Clean artifacts
pnpm clean
```

### Deployment

```bash
# Start local Hardhat node
pnpm hardhat node

# Deploy to localhost
pnpm run deploy --network localhost -f 00 # MockERC20
pnpm run deploy --network localhost -f 01 # RolesAuthority
pnpm run deploy --network localhost -f 02 # Vault + Accountant
pnpm run deploy --network localhost -f 03 # Teller
```

### Contract Sizes

All contracts are under the 24 KB Ethereum contract size limit:

| Contract | Size | % of Limit |
|----------|------|------------|
| TellerWithBuffer | 20.54 KB | 83.5% |
| Teller | 18.32 KB | 74.4% |
| BoringVault | 15.99 KB | 65.0% |
| AccountantProviders | 11.92 KB | 48.5% |
| Distributor | ~10 KB | ~40% |
| DelayedWithdraw | ~8 KB | ~33% |
| PrimeRegistry | ~6 KB | ~25% |
| RolesAuthority | 5.73 KB | 23.3% |

---

## Security

### Security Features

1. **Minimal Attack Surface** - Core vault contract is only ~100 lines
2. **Role-Based Access** - Granular permissions prevent unauthorized actions
3. **Share Lock Periods** - Prevents flashloan attacks and MEV
4. **Pausability** - Emergency pause functionality for Teller and Accountant
5. **Reentrancy Protection** - All external calls use ReentrancyGuard
6. **Fee Management** - Platform fees tracked and claimed separately
7. **Merkle Verification** - Manager actions verified through Merkle proofs
8. **Transfer Hooks** - Custom transfer restrictions for compliance

### Architecture Benefits

- **Separation of Concerns** - Strategy logic isolated from core vault
- **Upgradeability** - External modules can be replaced without touching vault
- **Auditability** - Each component is independently auditable
- **Composability** - Vault shares can be used in other DeFi protocols

### Audits

_Audits pending_

---

## Resources

- **Component Documentation** - See [Core Components](#core-components) table above
- **Strategy Guide** - [MANAGER_MERKLE.md](./MANAGER_MERKLE.md)
- **Veda Documentation** - https://docs.veda.tech/
- **BoringVault Architecture** - https://docs.veda.tech/architecture-and-flow-of-funds
- **Original BoringVault** - https://github.com/Veda-Labs/boring-vault

---

## License

MIT License

---

## Authors

**PrimeVaults Team**  
© 2025 PrimeVaults

Built with ❤️ using Hardhat, Viem, and Solidity ^0.8.30
