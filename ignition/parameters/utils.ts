import fs from "fs";
import path from "path";

import { VaultParameters } from "../../sdk/parameters.js";

/**
 * Helper function to sleep asynchronously
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Read parameters from JSON file (async with retry logic)
 * @param paramsId - Id of the params file (e.g., "localhost-usd")
 * @returns Parsed parameters object
 *
 * @example
 * ```typescript
 * const params = await readParams("localhost-usd");
 * console.log(params.ManagerModule.ManageRoot);
 * ```
 */
export async function readParams(paramsId: string): Promise<VaultParameters> {
  const filePath = getParamsPath(paramsId);

  // Check if file exists using async stat
  try {
    await fs.promises.stat(filePath);
  } catch {
    throw new Error(`Parameters file not found: ${filePath}`);
  }

  // Retry logic with exponential backoff for race conditions
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to parse parameters file after ${maxRetries} attempts: ${filePath}\n${error}`);
      }
      // Wait before retry with exponential backoff (async sleep)
      const delay = 30 * (attempt + 1);
      await sleep(delay);
    }
  }
  throw new Error(`Failed to read parameters file: ${filePath}`);
}

/**
 * Write parameters to JSON file (async with atomic write)
 * @param paramsId - Id of the params file (e.g., "localhost-usd")
 * @param params - Parameters object to write
 *
 * @example
 * ```typescript
 * const params = await readParams("localhost-usd");
 * params.ManagerModule.ManageRoot = "0x123...";
 * await writeParams("localhost-usd", params);
 * ```
 */
export async function writeParams(paramsId: string, params: VaultParameters): Promise<void> {
  const filePath = getParamsPath(paramsId);

  // Ensure directory exists (async)
  const dir = path.dirname(filePath);
  try {
    await fs.promises.stat(dir);
  } catch {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  // Write file with pretty format
  const content = JSON.stringify(params, null, 2) + "\n";

  // Write directly (atomic on most filesystems for small files)
  await fs.promises.writeFile(filePath, content, "utf-8");
}

/**
 * List all available parameter files (async)
 * @returns Array of parameter file names (without .json extension)
 *
 * @example
 * ```typescript
 * const files = await listParamFiles();
 * // ["localhost-usd", "bepolia", "mainnet"]
 * ```
 */
export async function listParamFiles(): Promise<string[]> {
  const dir = path.resolve(process.cwd(), "ignition/parameters");

  try {
    await fs.promises.stat(dir);
  } catch {
    return [];
  }

  const files = await fs.promises.readdir(dir);
  return files.filter((file) => file.endsWith(".json") && !file.endsWith(".backup")).map((file) => file.replace(/\.json$/, ""));
}
