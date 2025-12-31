# CLAUDE.md

## Overview

**Prime Vaults** is a yield-generating vault system on Berachain. Users deposit assets (HONEY/WBTC) and receive vault shares (pUSD/pBTC).

## Architecture

```
User ──► Teller ──► BoringVault ◄── Manager ──► DeFi Protocols
              │          │
              ▼          ▼
         Accountant   Distributor
              │
              ▼
       DelayedWithdraw
```

## Core Contracts

| Contract | Purpose | Docs |
|----------|---------|------|
| **BoringVault** | ERC20 vault shares, asset custody | [BORINGVAULT.md](docs/BORINGVAULT.md) |
| **Teller** | Deposit gateway | [TELLER.md](docs/TELLER.md) |
| **DelayedWithdraw** | 3-day withdrawal delay, 2% expedited fee | [DELAYEDWITHDRAW.md](docs/DELAYEDWITHDRAW.md) |
| **AccountantProviders** | Exchange rate, platform fees | [ACCOUNTANT.md](docs/ACCOUNTANT.md) |
| **Distributor** | Multi-token rewards (no staking) | [DISTRIBUTOR.md](docs/DISTRIBUTOR.md) |
| **Manager** | Merkle-verified strategy execution | [MANAGER.md](docs/MANAGER.md) |

## Additional Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design & contract interactions
- [SECURITY.md](docs/SECURITY.md) - Security practices & audit summary
- [TIMELOCK.md](docs/TIMELOCK.md) - PrimeTimelock deployment
- [AUDIT.md](docs/AUDIT.md) - SALUS Security Audit report

---

## SDK

### Import

```typescript
import {
  BerachainVaultUsd, BerachainVaultBtc,
  BepoliaVaultUsd, BepoliaVaultBtc,
  getVault, getVaultsByChainId, getLeaf,
  BoringVaultAbi, TellerAbi, WithdrawerAbi,
  AccountantAbi, DistributorAbi, ManagerAbi,
} from "@prime-vaults/contract/sdk";
```

### Vaults

| Vault | Chain ID | Symbol | Asset |
|-------|----------|--------|-------|
| `BerachainVaultUsd` | 80094 | pUSD | HONEY |
| `BerachainVaultBtc` | 80094 | pBTC | WBTC |
| `BepoliaVaultUsd` | 80069 | pUSD | Test HONEY |
| `BepoliaVaultBtc` | 80069 | pBTC | Test WBTC |

### Get Addresses

```typescript
const vault = BerachainVaultUsd;

vault.$global.BoringVaultAddress   // Vault
vault.$global.TellerAddress        // Deposit
vault.$global.WithdrawerAddress    // Withdraw
vault.$global.AccountantAddress    // Rate
vault.$global.DistributorAddress   // Rewards
vault.$global.ManagerAddress       // Strategy
vault.$global.stakingToken         // Base asset
```

### Basic Usage (viem)

```typescript
import { createPublicClient, http } from "viem";
import { berachain } from "viem/chains";

const client = createPublicClient({ chain: berachain, transport: http() });
const vault = BerachainVaultUsd;

// Get exchange rate
const rate = await client.readContract({
  address: vault.$global.AccountantAddress,
  abi: AccountantAbi.abi,
  functionName: "getRate",
});

// Get share balance
const shares = await client.readContract({
  address: vault.$global.BoringVaultAddress,
  abi: BoringVaultAbi.abi,
  functionName: "balanceOf",
  args: [userAddress],
});

// Get earned rewards
const earned = await client.readContract({
  address: vault.$global.DistributorAddress,
  abi: DistributorAbi.abi,
  functionName: "earned",
  args: [userAddress, rewardTokenAddress],
});
```

---

## User Flows

### Deposit

```typescript
// 1. Approve asset to Teller
await walletClient.writeContract({
  address: vault.$global.stakingToken,
  abi: erc20Abi,
  functionName: "approve",
  args: [vault.$global.TellerAddress, amount],
});

// 2. Deposit
await walletClient.writeContract({
  address: vault.$global.TellerAddress,
  abi: TellerAbi.abi,
  functionName: "deposit",
  args: [amount, minShares], // minShares = slippage protection
});
```

### Withdraw (3-day delay)

```typescript
// 1. Approve shares to Withdrawer
await walletClient.writeContract({
  address: vault.$global.BoringVaultAddress,
  abi: BoringVaultAbi.abi,
  functionName: "approve",
  args: [vault.$global.WithdrawerAddress, shares],
});

// 2. Request withdrawal
await walletClient.writeContract({
  address: vault.$global.WithdrawerAddress,
  abi: WithdrawerAbi.abi,
  functionName: "requestWithdraw",
  args: [shares, allowThirdParty],
});

// 3. After 3 days: complete
await walletClient.writeContract({
  address: vault.$global.WithdrawerAddress,
  abi: WithdrawerAbi.abi,
  functionName: "completeWithdraw",
  args: [userAddress, minAssets],
});

// OR: Accelerate (pay 2% fee, wait 1 day)
await walletClient.writeContract({
  address: vault.$global.WithdrawerAddress,
  abi: WithdrawerAbi.abi,
  functionName: "accelerateWithdraw",
});
```

### Claim Rewards

```typescript
// Get reward tokens
const rewards = await client.readContract({
  address: vault.$global.DistributorAddress,
  abi: DistributorAbi.abi,
  functionName: "getRewards",
});

// Claim
await walletClient.writeContract({
  address: vault.$global.DistributorAddress,
  abi: DistributorAbi.abi,
  functionName: "claimRewards",
  args: [rewards.map(r => r.rewardsToken)],
});

// Or compound (auto-reinvest)
await walletClient.writeContract({
  address: vault.$global.DistributorAddress,
  abi: DistributorAbi.abi,
  functionName: "compoundReward",
  args: [userAddress],
});
```

---

## Manager (Strategy Execution)

Uses Merkle proofs to verify approved operations.

```typescript
import { getLeaf, ManagerAbi } from "@prime-vaults/contract/sdk";
import { encodeFunctionData } from "viem";

// Get leaf + proof for operation
const leafData = getLeaf(vault, "Deposit base asset to PrimeStrategist");

// Execute via Manager
await walletClient.writeContract({
  address: vault.$global.ManagerAddress,
  abi: ManagerAbi.abi,
  functionName: "manageVaultWithMerkleVerification",
  args: [
    [leafData.proof],
    [leafData.leaf.DecoderAndSanitizerAddress],
    [leafData.leaf.TargetAddress],
    [calldata],
    [0n],
  ],
});
```

**Available operations:** See `ManagerModule.leafs` in vault parameters.

---

## Key Types

```typescript
interface TellerState {
  allowDeposits: boolean;
  allowWithdraws: boolean;
  shareLockPeriod: bigint;
  depositCap: bigint;
}

interface WithdrawRequest {
  allowThirdPartyToComplete: boolean;
  maturity: bigint;
  shares: bigint;
  sharesFee: bigint;
}

interface AccountantState {
  payoutAddress: Address;
  exchangeRate: bigint;
  feesOwedInBase: bigint;
  platformFee: number; // bps
}

interface RewardData {
  rewardsToken: Address;
  rewardsDuration: bigint;
  periodFinish: bigint;
  rewardRate: bigint;
}
```

---

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm compile          # Compile contracts
pnpm test             # Run tests
pnpm hardhat test path/to/test.ts  # Run single test
```

---

## Quick Reference

| Action | Contract | Function |
|--------|----------|----------|
| Deposit | Teller | `deposit(amount, minShares)` |
| Request Withdraw | DelayedWithdraw | `requestWithdraw(shares, allowThirdParty)` |
| Complete Withdraw | DelayedWithdraw | `completeWithdraw(user, minAssets)` |
| Accelerate | DelayedWithdraw | `accelerateWithdraw()` |
| Cancel Withdraw | DelayedWithdraw | `cancelWithdraw()` |
| Get Rate | Accountant | `getRate()` |
| Claim Rewards | Distributor | `claimRewards(tokens[])` |
| Compound | Distributor | `compoundReward(user)` |
| Check Earned | Distributor | `earned(user, token)` |
