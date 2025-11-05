read# Hardhat Template with Viem ⚡

[![Hardhat][hardhat-badge]][hardhat] [![License: MIT][license-badge]][license]

[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[license]: https://opensource.org/licenses/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

A modern Hardhat template for developing Solidity smart contracts with **Viem** integration, featuring automated
deployment workflows and sensible defaults.

## 🚀 Features

- **[Hardhat 3.x](https://hardhat.org/)** - Ethereum development environment
- **[Viem](https://viem.sh/)** - TypeScript interface for Ethereum (lightweight alternative to ethers.js)
- **[Hardhat Ignition](https://hardhat.org/ignition)** - Declarative deployment system
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe smart contract interactions
- **[Solhint](https://github.com/protofire/solhint)** - Solidity linter
- **[Prettier](https://prettier.io/)** - Code formatter with Solidity support
- **[ESLint](https://eslint.org/)** - TypeScript/JavaScript linter
- **Automated Deployment System** - Run all deployments in sequence with one command
- **Task Runner** - Execute contract interaction scripts easily

## 📦 What's Included

- **Sample Contracts**: `Staking.sol` and `MockERC20.sol` with OpenZeppelin integration
- **Deployment Scripts**: Automated deployment workflow in `scripts/deploy/`
- **Task Scripts**: Contract interaction examples in `scripts/tasks/`
- **Test Suite**: Complete test examples using Viem
- **Multi-network Configuration**: Ready for localhost, testnets, and mainnet

## 🏁 Getting Started

### Prerequisites

- **Node.js** >= 18.16.0
- **pnpm** (recommended) or npm/yarn

### Installation

1. **Clone or use this template**

   ```bash
   git clone <your-repo-url>
   cd hardhat-template-viem
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy the example env file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:

   ```env
   # Choose one authentication method:
   PRIVATE_KEY=your_private_key_here
   # OR
   MNEMONIC=your twelve word mnemonic phrase here

   # Network RPC URLs (optional, uses public RPCs by default)
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
   MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
   ```

   ⚠️ **Never commit your `.env` file!**

## 📁 Project Structure

```
hardhat-template-viem/
├── contracts/              # Solidity smart contracts
│   ├── Staking.sol        # Example staking contract
│   └── helper/
│       └── MockERC20.sol  # Mock ERC20 token for testing
├── ignition/
│   ├── modules/           # Hardhat Ignition deployment modules
│   │   ├── MockERC20.ts
│   │   └── staking.ts
│   ├── parameters/        # Network-specific parameters
│   │   ├── 31337.json    # Localhost
│   │   ├── bepolia.json  # Berachain testnet
│   │   └── ...
│   └── deployments/       # Deployment artifacts (auto-generated)
├── scripts/
│   ├── deploy/            # Deployment scripts (run in order)
│   │   ├── 00_mockERC20.ts
│   │   └── 01_staking.ts
│   ├── tasks/             # Contract interaction scripts
│   │   └── stake.ts
│   └── plugins/           # Automation plugins
│       ├── deploy.ts      # Auto-deploy runner
│       ├── tasks.ts       # Task runner
│       └── contract-size.ts
├── test/                  # Test files
│   └── Staking.ts
├── hardhat.config.ts      # Hardhat configuration
├── package.json
└── .env                   # Environment variables (create from .env.example)
```

## 🔧 Common Commands

### Development

```bash
# Clean artifacts and cache
pnpm clean

# Compile contracts
pnpm compile

# Run tests
pnpm test

# Check contract sizes
pnpm contract-size

# Lint code
pnpm lint              # Run all linters
pnpm lint:sol          # Lint Solidity only
pnpm lint:ts           # Lint TypeScript only
pnpm lint:fix          # Auto-fix linting issues
```

### Deployment

The deployment system automatically runs all scripts in `scripts/deploy/` in alphabetical order.

```bash
# Deploy to localhost (default)
pnpm deploy

# Deploy to specific network
pnpm deploy --network sepolia
pnpm deploy --network bepolia
pnpm deploy --network mainnet
```

**How it works:**

- Scripts are named with prefixes (`00_`, `01_`, etc.) to control execution order
- Each script runs sequentially - if one fails, deployment stops
- Deployment state is tracked in `ignition/deployments/`
- Contracts are reused if already deployed (based on deployment ID)

**Example: Creating a new deployment script**

Create `scripts/deploy/02_myContract.ts`:

```typescript
import MyContractModule from "../../ignition/modules/MyContract.js";
import hre from "hardhat";

export default async function main() {
  const connection = await hre.network.connect();

  const { myContract } = await connection.ignition.deploy(MyContractModule, {
    displayUi: true,
  });

  console.log(`MyContract deployed to: ${myContract.address}`);
  return myContract;
}

main().catch(console.error);
```

### Running Tasks

Tasks are scripts that interact with already-deployed contracts.

```bash
# Run a specific task
pnpm tasks stake --network localhost

# Run all tasks in sequence
pnpm tasks all --network sepolia

# List available tasks
pnpm tasks
```

**Example: Creating a new task**

Create `scripts/tasks/myTask.ts`:

```typescript
import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const [signer] = await connection.viem.getWalletClients();

  // Get your deployed contract
  const myContract = await connection.viem.getContractAt(
    "MyContract",
    "0x...", // contract address
  );

  // Interact with it
  const tx = await myContract.write.someFunction([arg1, arg2], {
    account: signer.account,
  });

  console.log(`Transaction hash: ${tx}`);
}

main().catch(console.error);
```

## 🌐 Network Configuration

### Supported Networks

The template comes pre-configured for:

- **localhost** / **hardhat** - Local development
- **sepolia** - Ethereum testnet
- **bepolia** - Berachain testnet
- **mainnet** - Ethereum mainnet

### Adding a New Network

1. **Edit `hardhat.config.ts`:**

```typescript
networks: {
  mynetwork: {
    chainId: 12345,
    url: process.env.MY_NETWORK_RPC_URL || "https://rpc.mynetwork.com",
    accounts,
  },
}
```

2. **Add RPC URL to `.env`:**

```env
MY_NETWORK_RPC_URL=https://rpc.mynetwork.com
```

3. **Create parameters file (optional):**

Create `ignition/parameters/mynetwork.json`:

```json
{
  "MockERC20Module": {
    "name": "Test Token",
    "symbol": "TEST",
    "initialSupply": "1000000000000000000000000"
  }
}
```

4. **Deploy:**

```bash
pnpm deploy --network mynetwork
```

## 🔍 Working with Viem

This template uses [Viem](https://viem.sh/) instead of ethers.js for a more modern, type-safe experience.

### Key Differences from Ethers.js

```typescript
// Getting clients
const publicClient = await connection.viem.getPublicClient(); // For reading
const [walletClient] = await connection.viem.getWalletClients(); // For writing

// Reading from contracts
const balance = await contract.read.balanceOf([address]);

// Writing to contracts
const hash = await contract.write.transfer([recipient, amount], {
  account: walletClient.account,
});

// Getting contract instance
const contract = await connection.viem.getContractAt("ContractName", contractAddress);
```

### Benefits of Viem

- ⚡ **Smaller bundle size** - ~5x smaller than ethers.js
- 🎯 **Better TypeScript support** - Full type inference
- 🚀 **Modern API** - Uses native BigInt instead of custom BigNumber
- 📦 **Tree-shakeable** - Import only what you need

## 🧪 Testing

Run the test suite:

```bash
pnpm test
```

Example test structure with Viem:

```typescript
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("MyContract", function () {
  async function deployFixture() {
    const connection = await hre.network.connect();
    const [owner, user] = await connection.viem.getWalletClients();

    const { myContract } = await connection.ignition.deploy(MyContractModule);

    return { myContract, owner, user, connection };
  }

  it("Should do something", async function () {
    const { myContract, owner } = await loadFixture(deployFixture);

    await myContract.write.someFunction([arg], {
      account: owner.account,
    });

    expect(await myContract.read.someValue()).to.equal(expectedValue);
  });
});
```

## 📝 Best Practices

### Deployment Scripts

1. **Use deployment IDs** to enable contract reuse across deployments
2. **Number your scripts** (`00_`, `01_`, etc.) to control execution order
3. **Return contract instances** so other scripts can import and use them
4. **Add console logs** to track deployment progress

### Task Scripts

1. **Check network** before executing sensitive operations
2. **Add descriptive logging** for better debugging
3. **Handle errors gracefully** with try-catch blocks
4. **Verify contract addresses** before interactions

### Security

1. **Never commit `.env` files** - they're gitignored by default
2. **Use separate wallets** for testnet and mainnet
3. **Double-check network** before deploying to mainnet
4. **Verify contracts** on block explorers after deployment

## 🛠️ Advanced Usage

### Contract Size Analysis

Check if your contracts are within size limits:

```bash
pnpm contract-size
```

### Custom Hardhat Tasks

You can still create traditional Hardhat tasks in `hardhat.config.ts`:

```typescript
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const connection = await hre.network.connect();
  const clients = await connection.viem.getWalletClients();

  for (const client of clients) {
    console.log(client.account.address);
  }
});
```

### Forking Mainnet

Test against mainnet state:

```bash
npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
```

Then deploy to the fork:

```bash
pnpm deploy --network localhost
```

## 🐛 Troubleshooting

### "No MNEMONIC or PRIVATE_KEY environment variable set"

**Solution:** Copy `.env.example` to `.env` and add your private key or mnemonic.

### "Contract already deployed" errors

**Solution:** Either:

- Use a different deployment ID in your script
- Clear deployments: `pnpm clean` (warning: removes all deployment history)
- Manually delete specific deployment in `ignition/deployments/`

### TypeScript errors in scripts

**Solution:** Make sure your imports use `.js` extensions:

```typescript
import MyModule from "./modules/MyModule.js";  // Correct
import MyModule from "./modules/MyModule";     // Wrong
```

### "Insufficient funds" errors

**Solution:** Make sure your wallet has enough native tokens (ETH, BERA, etc.) for gas fees.

## 📚 Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Hardhat Ignition Documentation](https://hardhat.org/ignition/docs/getting-started)
- [Viem Documentation](https://viem.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Solidity Documentation](https://docs.soliditylang.org/)

## 📄 License

This project is licensed under the MIT License.
