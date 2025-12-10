# Prime Vaults ABI Guide

Quick reference for AI clients to interact with Prime Vaults contracts.

---

## Contract Overview

| Contract        | Address           | Purpose                       |
| --------------- | ----------------- | ----------------------------- |
| BoringVault     | `vault`           | ERC20 shares & asset custody  |
| Teller          | `teller`          | User deposit/withdraw gateway |
| Accountant      | `accountant`      | Exchange rate & fees          |
| Manager         | `manager`         | Strategy execution            |
| DelayedWithdraw | `delayedWithdraw` | Time-locked withdrawals       |
| Distributor     | `distributor`     | Reward distribution           |

---

## Common User Flows

### 1. Deposit Assets

```solidity
// Step 1: Approve asset transfer
ERC20(asset).approve(teller, amount)

// Step 2: Deposit
Teller(teller).deposit(
  uint256 depositAmount,    // Amount to deposit
  uint256 minimumMint,      // Min shares (slippage protection)
  address to                // Recipient
) returns (uint256 shares)
```

**Example:**

```javascript
// Deposit 100 USDC, expect at least 90 shares
asset.approve(teller, 100e6);
shares = teller.deposit(100e6, 90e18, userAddress);
```

### 2. Withdraw Assets (Instant)

```solidity
// Withdraw immediately (if allowed)
Teller(teller).withdraw(
  uint256 shareAmount,      // Shares to burn
  uint256 minimumAssets,    // Min assets (slippage protection)
  address to                // Recipient
) returns (uint256 assetsOut)
```

**Example:**

```javascript
// Withdraw 100 shares, expect at least 108 USDC
assets = teller.withdraw(100e18, 108e6, userAddress);
```

### 3. Withdraw Assets (Delayed)

```solidity
// Step 1: Request withdrawal
DelayedWithdraw(delayedWithdraw).requestWithdraw(
  uint96 shares,                    // Shares to withdraw
  bool allowThirdPartyToComplete    // Allow others to complete
) returns (uint256 assets)

// Step 2: Wait for maturity (e.g., 3 days)

// Step 3: Complete withdrawal
DelayedWithdraw(delayedWithdraw).completeWithdraw(
  address account    // User account
)
```

**Example:**

```javascript
// Request withdrawal of 100 shares
delayedWithdraw.requestWithdraw(100e18, false);

// Wait 3 days...

// Complete withdrawal
delayedWithdraw.completeWithdraw(userAddress);
```

### 4. Claim Rewards

```solidity
// Claim all pending rewards
Distributor(distributor).claimRewards(
  address[] memory rewardTokens    // Array of reward token addresses
) returns (uint256[] memory amounts)
```

**Example:**

```javascript
// Claim USDC and WETH rewards
rewardTokens = [usdcAddress, wethAddress];
amounts = distributor.claimRewards(rewardTokens);
```

---

## Read-Only Functions

### Check Balance & Value

```solidity
// Get share balance
BoringVault(vault).balanceOf(address account) returns (uint256)

// Get total shares
BoringVault(vault).totalSupply() returns (uint256)

// Get current exchange rate
Accountant(accountant).getRate() returns (uint256)
// Rate format: baseAsset per share (e.g., 1.1e6 = 1.1 USDC per share)

// Calculate asset value
function getAssetValue(address account) returns (uint256) {
  uint256 shares = vault.balanceOf(account)
  uint256 rate = accountant.getRate()
  return shares * rate / 1e18
}
```

### Check Pending Rewards

```solidity
// Get pending reward for single token
Distributor(distributor).earned(
  address account,
  address rewardToken
) returns (uint256)

// Get all reward tokens
Distributor(distributor).getRewardTokens() returns (address[] memory)
```

### Check Withdrawal Request

```solidity
// Get pending withdrawal request
DelayedWithdraw(delayedWithdraw).withdrawRequests(
  address account
) returns (
  bool allowThirdPartyToComplete,
  uint40 maturity,
  uint96 shares,
  uint96 exchangeRateAtTimeOfRequest
)

// Check if withdrawal is ready
function isWithdrawReady(address account) returns (bool) {
  (,uint40 maturity,,) = delayedWithdraw.withdrawRequests(account)
  return maturity > 0 && block.timestamp >= maturity
}
```

---

## Key Formulas

### Share ↔ Asset Conversion

```javascript
// Deposit: Asset → Shares
shares = (depositAmount * 1e18) / exchangeRate;

// Withdraw: Shares → Asset
assets = (shareAmount * exchangeRate) / 1e18;
```

### Exchange Rate

```javascript
// Rate represents: base asset per share
// Example: rate = 1.1e6 means 1 share = 1.1 USDC

exchangeRate = (totalAssets - feesOwed) / totalShares;
```

### Reward Calculation

```javascript
// Reward per token stored
rewardPerToken = lastRewardPerToken + ((currentTime - lastUpdateTime) * rewardRate) / totalShares;

// User pending reward
earned = userShares * (rewardPerToken - userRewardPerTokenPaid) + storedReward;
```

---

## Events to Monitor

### Deposits & Withdrawals

```solidity
// BoringVault
event Enter(address indexed from, address indexed asset, uint256 amount, address indexed to, uint256 shares)
event Exit(address indexed to, address indexed asset, uint256 amount, address indexed from, uint256 shares)

// Teller
event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)
event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)

// DelayedWithdraw
event WithdrawRequested(address indexed account, uint256 shares, uint256 assets, uint40 maturity)
event WithdrawCompleted(address indexed account, uint256 shares, uint256 assets)
```

### Rewards

```solidity
// Distributor
event RewardAdded(address indexed rewardsToken, uint256 reward)
event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward)
event Claimed(address indexed user, address indexed rewardsToken, uint256 reward)
```

### Exchange Rate Updates

```solidity
// Accountant
event ExchangeRateUpdated(uint96 oldRate, uint96 newRate, uint64 currentTime)
event FeesClaimed(address indexed feeAsset, uint256 amount)
```

---

## Error Handling

### Common Errors

```solidity
// Teller
error Teller__SharesAreLocked()        // Shares still locked after deposit
error Teller__MinimumMintNotMet()      // Slippage: received < minimumMint
error Teller__MinimumAssetsNotMet()    // Slippage: received < minimumAssets
error Teller__DepositCapExceeded()     // Deposit would exceed TVL cap
error Teller__Paused()                 // Contract is paused

// DelayedWithdraw
error WithdrawNotMatured()             // Must wait for maturity
error NoWithdrawPending()              // No active withdrawal request
error WithdrawAlreadyPending()         // Cannot request twice

// Distributor
error InvalidRewardToken()             // Token not configured
error InsufficientRewardBalance()      // Contract lacks reward tokens
```

---

## Access Control (Roles)

### User Accessible (PUBLIC)

```solidity
// Anyone can call
Teller.deposit()
Teller.withdraw()
DelayedWithdraw.requestWithdraw()
DelayedWithdraw.completeWithdraw()
Distributor.claimRewards()
BoringVault.transfer()
```

### Restricted Functions

```solidity
// SOLVER_ROLE (market makers, bots)
Teller.bulkDeposit()
Teller.bulkWithdraw()

// PROTOCOL_ADMIN
Teller.setDepositCap()
DelayedWithdraw.setupWithdrawAsset()
Distributor.notifyRewardAmount()

// MANAGER_ROLE (strategy execution)
BoringVault.manage()
```

---

## Example Integration

### TypeScript + Viem (Recommended)

```typescript
import { AccountantAbi, BoringVaultAbi, TellerAbi, DistributorAbi, WithdrawerAbi, BepoliaVaultUsd } from "@prime-vaults/sdk";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { berachainTestnetbArtio } from "viem/chains";

// Setup clients
const publicClient = createPublicClient({
  chain: berachainTestnetbArtio,
  transport: http(),
});

const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: berachainTestnetbArtio,
  transport: http(),
});

// Contract addresses from deployment parameters
const addresses = BepoliaVaultUsd.$global;

// 1. Deposit Flow
async function deposit(amount: bigint) {
  // Step 1: Approve asset
  const { request: approveRequest } = await publicClient.simulateContract({
    address: addresses.stakingToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [addresses.TellerAddress, amount],
    account,
  });
  const approveTx = await walletClient.writeContract(approveRequest);
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Step 2: Get exchange rate for slippage calculation
  const rate = await publicClient.readContract({
    address: addresses.AccountantAddress,
    abi: AccountantAbi.abi,
    functionName: "getRate",
  });

  const expectedShares = (amount * parseUnits("1", 18)) / rate;
  const minimumShares = (expectedShares * 98n) / 100n; // 2% slippage

  // Step 3: Deposit
  const { request: depositRequest } = await publicClient.simulateContract({
    address: addresses.TellerAddress,
    abi: TellerAbi.abi,
    functionName: "deposit",
    args: [amount, minimumShares, account.address],
    account,
  });

  const depositTx = await walletClient.writeContract(depositRequest);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });

  console.log("Deposit successful:", receipt.transactionHash);
  return receipt;
}

// 2. Check User Info
async function getUserInfo(userAddress: `0x${string}`) {
  // Get share balance
  const shares = await publicClient.readContract({
    address: addresses.BoringVaultAddress,
    abi: BoringVaultAbi.abi,
    functionName: "balanceOf",
    args: [userAddress],
  });

  // Get exchange rate
  const rate = await publicClient.readContract({
    address: addresses.AccountantAddress,
    abi: AccountantAbi.abi,
    functionName: "getRate",
  });

  // Calculate asset value
  const assetValue = (shares * rate) / parseUnits("1", 18);

  // Get reward tokens
  const rewardTokens = await publicClient.readContract({
    address: addresses.DistributorAddress,
    abi: DistributorAbi.abi,
    functionName: "getRewardTokens",
  });

  // Get pending rewards for each token
  const pendingRewards = await Promise.all(
    rewardTokens.map((token) =>
      publicClient.readContract({
        address: addresses.DistributorAddress,
        abi: DistributorAbi.abi,
        functionName: "earned",
        args: [userAddress, token],
      }),
    ),
  );

  return {
    shares,
    assetValue,
    exchangeRate: rate,
    pendingRewards: rewardTokens.map((token, i) => ({
      token,
      amount: pendingRewards[i],
    })),
  };
}

// 3. Claim Rewards
async function claimRewards() {
  // Get all reward tokens
  const rewardTokens = await publicClient.readContract({
    address: addresses.DistributorAddress,
    abi: DistributorAbi.abi,
    functionName: "getRewardTokens",
  });

  // Claim all rewards
  const { request } = await publicClient.simulateContract({
    address: addresses.DistributorAddress,
    abi: DistributorAbi.abi,
    functionName: "claimRewards",
    args: [rewardTokens],
    account,
  });

  const tx = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  console.log("Rewards claimed:", receipt.transactionHash);
  return receipt;
}

// 4. Instant Withdraw (if enabled)
async function withdraw(shares: bigint) {
  // Get exchange rate
  const rate = await publicClient.readContract({
    address: addresses.AccountantAddress,
    abi: AccountantAbi.abi,
    functionName: "getRate",
  });

  const expectedAssets = (shares * rate) / parseUnits("1", 18);
  const minimumAssets = (expectedAssets * 98n) / 100n; // 2% slippage

  // Withdraw
  const { request } = await publicClient.simulateContract({
    address: addresses.TellerAddress,
    abi: TellerAbi.abi,
    functionName: "withdraw",
    args: [shares, minimumAssets, account.address],
    account,
  });

  const tx = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  console.log("Withdrawal successful:", receipt.transactionHash);
  return receipt;
}

// 5. Delayed Withdraw
async function delayedWithdraw(shares: bigint) {
  // Step 1: Request withdrawal
  const { request: requestReq } = await publicClient.simulateContract({
    address: addresses.WithdrawerAddress,
    abi: WithdrawerAbi.abi,
    functionName: "requestWithdraw",
    args: [shares, false], // false = only user can complete
    account,
  });

  const requestTx = await walletClient.writeContract(requestReq);
  await publicClient.waitForTransactionReceipt({ hash: requestTx });

  // Step 2: Get withdrawal request details
  const request = await publicClient.readContract({
    address: addresses.WithdrawerAddress,
    abi: WithdrawerAbi.abi,
    functionName: "withdrawRequests",
    args: [account.address],
  });

  const maturityTime = request.maturity;
  console.log(`Withdrawal ready at: ${new Date(Number(maturityTime) * 1000)}`);

  // Step 3: Complete withdrawal (after maturity)
  const now = Math.floor(Date.now() / 1000);
  if (now >= maturityTime) {
    const { request: completeReq } = await publicClient.simulateContract({
      address: addresses.WithdrawerAddress,
      abi: WithdrawerAbi.abi,
      functionName: "completeWithdraw",
      args: [account.address],
      account,
    });

    const completeTx = await walletClient.writeContract(completeReq);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: completeTx });

    console.log("Withdrawal completed:", receipt.transactionHash);
    return receipt;
  }
}

// 6. Watch Events
async function watchDeposits() {
  const unwatch = publicClient.watchContractEvent({
    address: addresses.TellerAddress,
    abi: TellerAbi.abi,
    eventName: "Deposit",
    onLogs: (logs) => {
      logs.forEach((log) => {
        console.log("Deposit event:", {
          user: log.args.owner,
          assets: log.args.assets,
          shares: log.args.shares,
        });
      });
    },
  });

  return unwatch;
}

// 7. Multicall - Get multiple data in one call
async function getVaultStats() {
  const results = await publicClient.multicall({
    contracts: [
      {
        address: addresses.BoringVaultAddress,
        abi: BoringVaultAbi.abi,
        functionName: "totalSupply",
      },
      {
        address: addresses.AccountantAddress,
        abi: AccountantAbi.abi,
        functionName: "getRate",
      },
      {
        address: addresses.DistributorAddress,
        abi: DistributorAbi.abi,
        functionName: "getRewardTokens",
      },
    ],
  });

  const [totalSupply, exchangeRate, rewardTokens] = results.map((r) => r.result);
  const tvl = (totalSupply * exchangeRate) / parseUnits("1", 18);

  return {
    totalSupply,
    exchangeRate,
    tvl,
    rewardTokens,
  };
}
```

### TypeScript + Ethers.js

```typescript
import { ethers } from "ethers";

// Initialize contracts
const vault = new ethers.Contract(vaultAddress, BoringVaultABI, signer);
const teller = new ethers.Contract(tellerAddress, TellerABI, signer);
const accountant = new ethers.Contract(accountantAddress, AccountantABI, provider);
const distributor = new ethers.Contract(distributorAddress, DistributorABI, signer);

// Deposit flow
async function deposit(amount: bigint) {
  // Approve
  const asset = new ethers.Contract(assetAddress, ERC20ABI, signer);
  await asset.approve(tellerAddress, amount);

  // Get current rate for slippage calculation
  const rate = await accountant.getRate();
  const expectedShares = (amount * 1n * 10n ** 18n) / rate;
  const minimumShares = (expectedShares * 98n) / 100n; // 2% slippage

  // Deposit
  const tx = await teller.deposit(amount, minimumShares, await signer.getAddress());
  const receipt = await tx.wait();

  return receipt;
}

// Check user info
async function getUserInfo(address: string) {
  const shares = await vault.balanceOf(address);
  const rate = await accountant.getRate();
  const assetValue = (shares * rate) / 10n ** 18n;

  const rewardTokens = await distributor.getRewardTokens();
  const pendingRewards = await Promise.all(rewardTokens.map((token) => distributor.earned(address, token)));

  return {
    shares,
    assetValue,
    pendingRewards: rewardTokens.map((token, i) => ({
      token,
      amount: pendingRewards[i],
    })),
  };
}

// Withdraw (delayed)
async function withdrawDelayed(shares: bigint) {
  // Request
  const tx1 = await delayedWithdraw.requestWithdraw(shares, false);
  await tx1.wait();

  // Get maturity time
  const request = await delayedWithdraw.withdrawRequests(await signer.getAddress());
  const maturityTime = request.maturity;

  console.log(`Withdrawal will be ready at: ${new Date(maturityTime * 1000)}`);

  // Complete (after maturity)
  // ... wait for maturity ...
  const tx2 = await delayedWithdraw.completeWithdraw(await signer.getAddress());
  await tx2.wait();
}
```

### Python

```python
from web3 import Web3

# Initialize
w3 = Web3(Web3.HTTPProvider(rpc_url))
vault = w3.eth.contract(address=vault_address, abi=boring_vault_abi)
teller = w3.eth.contract(address=teller_address, abi=teller_abi)
accountant = w3.eth.contract(address=accountant_address, abi=accountant_abi)

# Deposit
def deposit(amount: int, user_address: str, private_key: str):
    # Approve
    asset = w3.eth.contract(address=asset_address, abi=erc20_abi)
    approve_tx = asset.functions.approve(teller_address, amount).build_transaction({
        'from': user_address,
        'nonce': w3.eth.get_transaction_count(user_address)
    })
    signed = w3.eth.account.sign_transaction(approve_tx, private_key)
    w3.eth.send_raw_transaction(signed.rawTransaction)

    # Calculate slippage
    rate = accountant.functions.getRate().call()
    expected_shares = amount * 10**18 // rate
    minimum_shares = expected_shares * 98 // 100

    # Deposit
    deposit_tx = teller.functions.deposit(amount, minimum_shares, user_address).build_transaction({
        'from': user_address,
        'nonce': w3.eth.get_transaction_count(user_address)
    })
    signed = w3.eth.account.sign_transaction(deposit_tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)

    return w3.eth.wait_for_transaction_receipt(tx_hash)

# Get user info
def get_user_info(address: str) -> dict:
    shares = vault.functions.balanceOf(address).call()
    rate = accountant.functions.getRate().call()
    asset_value = shares * rate // 10**18

    return {
        'shares': shares,
        'asset_value': asset_value,
        'rate': rate
    }
```

---

## Contract Addresses

See deployment artifacts in:

- `ignition/deployments/bepolia-usd/`
- `ignition/deployments/bepolia-btc/`

Or check `sdk/parameters.ts` for current deployment addresses.

---

## Additional Resources

- [README.md](./README.md) - System overview
- [BORINGVAULT_README.md](./BORINGVAULT_README.md) - Core vault details
- [TELLER_README.md](./TELLER_README.md) - Deposit/withdrawal flows
- [ACCOUNTANT_README.md](./ACCOUNTANT_README.md) - Exchange rate mechanics
- [DISTRIBUTOR_README.md](./DISTRIBUTOR_README.md) - Reward system
- [DELAYEDWITHDRAW_README.md](./DELAYEDWITHDRAW_README.md) - Time-lock mechanics
- [MANAGER_README.md](./MANAGER_README.md) - Strategy execution
