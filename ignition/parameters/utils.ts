import fs from "fs";
import path from "path";

import { VaultParameters } from "../../sdk/parameters.js";

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
export function readParams(paramsId: string): VaultParameters {
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
export async function writeParams(paramsId: string, params: VaultParameters): Promise<void> {
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
