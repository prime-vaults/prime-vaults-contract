import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";
import { HttpNetworkAccountsUserConfig } from "hardhat/types/config";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import {
  arbitrum,
  arbitrumSepolia,
  berachain,
  berachainBepolia,
  bsc,
  bscTestnet,
  coreDao,
  mainnet,
  sepolia,
} from "viem/chains";

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC;

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (MNEMONIC && PRIVATE_KEY) {
  throw new Error("Both MNEMONIC and PRIVATE_KEY environment variables are set. PRIVATE_KEY will take precedence.");
}

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC ? { mnemonic: MNEMONIC } : PRIVATE_KEY ? [PRIVATE_KEY] : undefined;

if (accounts == null) {
  console.warn("⚠️  Warning: No MNEMONIC or PRIVATE_KEY environment variable set. Deployments may fail if the network requires authentication.");
}

// Log admin address for verification
if (MNEMONIC) {
  const account = mnemonicToAccount(MNEMONIC);
  console.log("Admin address:", account.address);
  console.log("priv", Buffer.from(account.getHdKey().privateKey!).toString("hex"));
} else if (PRIVATE_KEY) {
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log("Admin address:", account.address);
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
    profiles: {
      default: {
        version: "0.8.30",
      },
      production: {
        version: "0.8.30",
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
      allowBlocksWithSameTimestamp: true,
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    bepolia: {
      type: "http",
      chainType: "op",
      accounts,
      url: process.env.RPC_URL || berachainBepolia.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://testnet.berascan.com",
      },
      chainId: berachainBepolia.id,
    },
    berachain: {
      type: "http",
      chainType: "op",
      accounts,
      url: process.env.RPC_URL || berachain.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://berascan.com",
      },
      chainId: berachain.id,
    },
    // BNB Chain
    bsc: {
      type: "http",
      chainType: "l1",
      accounts,
      url: process.env.RPC_URL || bsc.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://bscscan.com",
      },
      chainId: bsc.id,
    },
    bscTestnet: {
      type: "http",
      chainType: "l1",
      accounts,
      url: process.env.RPC_URL || bscTestnet.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://testnet.bscscan.com",
      },
      chainId: bscTestnet.id,
    },
    // Ethereum
    mainnet: {
      type: "http",
      chainType: "l1",
      accounts,
      url: process.env.RPC_URL || mainnet.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://etherscan.io",
      },
      chainId: mainnet.id,
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      accounts,
      url: process.env.RPC_URL || sepolia.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://sepolia.etherscan.io",
      },
      chainId: sepolia.id,
    },
    // CoreDAO
    coreDao: {
      type: "http",
      chainType: "l1",
      accounts,
      url: process.env.RPC_URL || coreDao.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://scan.coredao.org",
      },
      chainId: coreDao.id,
    },
    // Arbitrum
    arbitrum: {
      type: "http",
      chainType: "op",
      accounts,
      url: process.env.RPC_URL || arbitrum.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://arbiscan.io",
      },
      chainId: arbitrum.id,
    },
    arbitrumSepolia: {
      type: "http",
      chainType: "op",
      accounts,
      url: process.env.RPC_URL || arbitrumSepolia.rpcUrls.default.http[0],
      timeout: 60000,
      ignition: {
        explorerUrl: "https://sepolia.arbiscan.io",
      },
      chainId: arbitrumSepolia.id,
    },
  },
};

export default config;
