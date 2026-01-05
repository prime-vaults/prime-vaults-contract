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
| **BoringVault** | Asset custody & ERC20 shares | [Details](./docs/BORINGVAULT.md) |
| **Accountant** | Exchange rates & platform fees | [Details](./docs/ACCOUNTANT.md) |
| **Teller** | Deposit/withdrawal gateway | [Details](./docs/TELLER.md) |
| **Manager** | Strategy execution | [Details](./docs/MANAGER.md) |
| **DelayedWithdraw** | Time-locked withdrawals | [Details](./docs/DELAYEDWITHDRAW.md) |
| **Distributor** | Multi-token rewards | [Details](./docs/DISTRIBUTOR.md) |

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

## Deployments

### Berachain Mainnet (Chain ID: 80094)

#### pUSD Vault (HONEY)

| Contract | Address |
|----------|---------|
| BoringVault | `0x8596cD23aa747Fd867235D422F3C4896A5A6Bb24` |
| Accountant | `0xa2d2085504c3e7C83e8E37b33Df50709c00f2bBB` |
| Teller | `0xC59b0CE194Bf8b202f21C03F6F9F394eEf10d1CF` |
| Distributor | `0x5429F08D515f65681418145A367046712D4adDa2` |
| DelayedWithdraw | `0xFE609D66BC15b409b8F657cA0F78c95031C7D26c` |
| Manager | `0x1E526f3255458Dd0a38D1F018eda7518A4A6a8E2` |
| Staking Token (HONEY) | `0x549943e04f40284185054145c6E4e9568C1D3241` |

#### pBTC Vault (WBTC)

| Contract | Address |
|----------|---------|
| BoringVault | `0x5a4C11645E58E732092494db0dBb57B0646CDa1d` |
| Accountant | `0xd7300E0C572AEd4251dED65C70c74d2c7732197A` |
| Teller | `0x87E842c626a4c14C60B2acE6293400a4000Df4be` |
| Distributor | `0xbf84E1cBc598952536F62Da3F6F39dF786C95bef` |
| DelayedWithdraw | `0x540E06c68366aA3f79D700b7d82c69cEabDB9990` |
| Manager | `0xb47197d81604f3058BdDd993372a14a36183a11f` |
| Staking Token (WBTC) | `0x0555E30da8f98308EdB960aa94C0Db47230d2B9c` |

#### Shared Infrastructure (Mainnet)

| Contract | Address |
|----------|---------|
| PrimeRBAC | `0xe4d53b98e09FdAb10aFaB99393AD0ffbe37dD446` |
| PrimeTimelock | `0x8C256f131D86b7301106F943221f749157B1FeF3` |
| DecoderAndSanitizer | `0x7178182Fd96148B4E72b2b1e93292b0A493A7fB4` |
| PrimeStrategist | `0xcfDB218585d77BeD370781D9C5eF40CeFa634427` |

### Bepolia Testnet (Chain ID: 80069)

#### pUSD Vault (Test)

| Contract | Address |
|----------|---------|
| BoringVault | `0x21fc7d2c8469289D1FDfC28C29141DC911FFb4aD` |
| Accountant | `0x1cC0b0FeCeBa56D4Cf08008d7ae2B66A589Ae64b` |
| Teller | `0xF60b79b38ec5bDF1E91429D17BfF4C64DA137043` |
| Distributor | `0x7ffc7c1F139C8F81d5829C70d0996bB25FeE6D98` |
| DelayedWithdraw | `0x6905f3Edb89b8e1CD8e9C0f1EE769973f1c70C2E` |
| Manager | `0xc31d6690b6f03A03bD99167F4193D7b1e35dFA6A` |
| Staking Token | `0x312203a9df1b39824a826e4ceb266541d6e0feaa` |

#### pBTC Vault (Test)

| Contract | Address |
|----------|---------|
| BoringVault | `0x5C304674C8f9566BC646b903c03eE504C77d7E0f` |
| Accountant | `0xE7CeEe1832fF9163404915B6F9e655368A11A9BF` |
| Teller | `0x1e859D988a2b506D2b4CA017b5EeCCB487E1B899` |
| Distributor | `0x2Dd919b34e090F7fBabc8EDd283ef53241A042dD` |
| DelayedWithdraw | `0x0FD74ffC76CFc7C576146c12B468E610BD396c4A` |
| Manager | `0x295aaC265561aC7940C896b7606dA8Dd2505cd72` |
| Staking Token | `0xde9decc3a84cf9cd197ca51ec998a475cc4e8469` |

#### Shared Infrastructure (Testnet)

| Contract | Address |
|----------|---------|
| PrimeRBAC | `0xbee1B382cfdfC78A893bf837F8AB39FCA0a2F79E` |
| DecoderAndSanitizer | `0x37018ba2974de55926fFa7ADA2d7529D3aef84eA` |
| PrimeStrategist | `0x574EF500E7Ed1212264F04509F9876A116823a9E` |

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

Audited by **SALUS Security** (December 2025). See [docs/AUDIT.md](./docs/AUDIT.md) for full report and [docs/SECURITY.md](./docs/SECURITY.md) for security best practices.

---

## Resources

- **Architecture Overview** - [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Security Guide** - [docs/SECURITY.md](./docs/SECURITY.md)
- **Timelock Setup** - [docs/TIMELOCK.md](./docs/TIMELOCK.md)
- **Cross-chain Bridge** - [docs/CROSSCHAIN.md](./docs/CROSSCHAIN.md)
- **Veda Documentation** - https://docs.veda.tech/
- **Original BoringVault** - https://github.com/Veda-Labs/boring-vault

---

## License

MIT License

---

## Authors

**PrimeVaults Team**  
© 2025 PrimeVaults

Built with ❤️ using Hardhat, Viem, and Solidity ^0.8.30
