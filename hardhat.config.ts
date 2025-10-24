import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";
import { HttpNetworkAccountsUserConfig } from "hardhat/types/config";

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

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
  ? { mnemonic: MNEMONIC }
  : PRIVATE_KEY
    ? [PRIVATE_KEY]
    : undefined;

if (accounts == null) {
  console.warn(
    "⚠️  Warning: No MNEMONIC or PRIVATE_KEY environment variable set. Deployments may fail if the network requires authentication.",
  );
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
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
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
    bepolia: {
      type: "http",
      chainType: "l1",
      accounts,
      url: process.env.RPC_URL!,
    },
  },
};

export default config;
