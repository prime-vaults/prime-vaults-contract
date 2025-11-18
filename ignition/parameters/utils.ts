import fs from "fs";
import path from "path";

/**
 * Global configuration interface
 */
export interface GlobalConfig {
  id: string;
  adminAddress: `0x${string}`;
  wrapNative: `0x${string}`;
  stakingToken: `0x${string}`;
  PrimeStrategistAddress: `0x${string}`;
  DecoderAndSanitizerAddress: `0x${string}`;
  ADMIN_ROLE: number;
  MANAGER_ROLE: number;
  MINTER_ROLE: number;
  BORING_VAULT_ROLE: number;
  STRATEGIST_ROLE: number;
  BURNER_ROLE: number;
  SOLVER_ROLE: number;
  QUEUE_ROLE: number;
  CAN_SOLVE_ROLE: number;
}

export interface Metadata {
  BoringVaultAddress: `0x${string}`;
  AccountantAddress: `0x${string}`;
  TellerAddress: `0x${string}`;
  WithdrawerAddress: `0x${string}`;
  ManagerAddress: `0x${string}`;
  PrimeRegistryAddress: `0x${string}`;
  RolesAuthorityAddress: `0x${string}`;
  ManageRoot: `0x${string}`;
  leafs: LeafConfig[];
}

/**
 * Leaf configuration interface
 */
export interface LeafConfig {
  Description: string;
  FunctionSignature: string;
  FunctionSelector: `0x${string}`;
  DecoderAndSanitizerAddress: `0x${string}`;
  TargetAddress: `0x${string}`;
  CanSendValue: boolean;
  AddressArguments: `0x${string}`[];
  PackedArgumentAddresses: string;
  LeafDigest: `0x${string}`;
}

/**
 * Manager module interface
 */
export interface ManagerModule {
  ManageRoot: `0x${string}`;
  leafs: LeafConfig[];
}

/**
 * Interface for parameter file structure
 */
export interface ParamsJson {
  $global: GlobalConfig;
  $metadata: Metadata;
  ManagerModule?: ManagerModule; // Optional for backward compatibility
  [key: string]: any;
}

/**
 * Get the full path to a parameters file
 * @param paramsId - Id of the params file (e.g., "localhost-usd")
 * @returns Absolute path to the params file
 */
export function getParamsPath(paramsId: string): string {
  const fileName = paramsId.replace(/\.json$/i, "");
  return path.resolve(process.cwd(), `ignition/parameters/${fileName}.json`);
}

/**
 * Read parameters from JSON file
 * @param paramsId - Id of the params file (e.g., "localhost-usd")
 * @returns Parsed parameters object
 *
 * @example
 * ```typescript
 * const params = readParams("localhost-usd");
 * console.log(params.ManagerModule.ManageRoot);
 * ```
 */
export function readParams(paramsId: string): ParamsJson {
  const filePath = getParamsPath(paramsId);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Parameters file not found: ${filePath}`);
  }

  // Retry logic with exponential backoff for race conditions
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to parse parameters file after ${maxRetries} attempts: ${filePath}\n${error}`);
      }
      // Wait before retry with exponential backoff (synchronous sleep)
      const delay = 30 * (attempt + 1);
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait (not ideal but works for short delays in Node.js)
      }
    }
  }
  throw new Error(`Failed to read parameters file: ${filePath}`);
}

/**
 * Write parameters to JSON file
 * @param paramsId - Id of the params file (e.g., "localhost-usd")
 * @param params - Parameters object to write
 *
 * @example
 * ```typescript
 * const params = readParams("localhost-usd");
 * params.ManagerModule.ManageRoot = "0x123...";
 * await writeParams("localhost-usd", params);
 * ```
 */
export async function writeParams(paramsId: string, params: ParamsJson): Promise<void> {
  const filePath = getParamsPath(paramsId);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file with pretty format
  const content = JSON.stringify(params, null, 2) + "\n";

  await fs.promises.writeFile(filePath, content, "utf-8");
}

/**
 * List all available parameter files
 * @returns Array of parameter file names (without .json extension)
 *
 * @example
 * ```typescript
 * const files = listParamFiles();
 * // ["localhost-usd", "bepolia", "mainnet"]
 * ```
 */
export function listParamFiles(): string[] {
  const dir = path.resolve(process.cwd(), "ignition/parameters");

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json") && !file.endsWith(".backup"))
    .map((file) => file.replace(/\.json$/, ""));
}
