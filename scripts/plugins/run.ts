#!/usr/bin/env tsx
import chalk from "chalk";
import { spawn } from "child_process";
import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ArgMap = Record<string, string>;

export function parseArgs(argv: string[] = process.argv.slice(2)): ArgMap {
  const args: ArgMap = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);

      // Check if next arg is a value or another flag
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++; // skip next
      }
    }
  }

  return args;
}

async function main() {
  // Get network from command line args
  const args = parseArgs();
  const { dir, network } = args;
  if (!args.dir) throw new Error("Missing --dir argument");
  if (!args.network) throw new Error("Missing --network argument");

  console.log(`🚀 Starting script to network: ${network}\n`);

  // Read all scripts from the <dir> directory
  const deployDir = path.join(__dirname, "../", dir);
  const files = readdirSync(deployDir)
    .filter((file) => file.endsWith(".ts"))
    .sort(); // Sort to ensure correct order (00_, 01_, etc.)

  console.log(`📁 Found ${files.length} script(s):\n`);
  files.forEach((file) => console.log(`   - ${file}`));
  console.log();

  // Run each script in order
  for (const file of files) {
    const scriptPath = path.join(deployDir, file);
    console.log(chalk.blue(`📝 Running: ${dir}/${file}...`));

    await new Promise<void>((resolve, reject) => {
      const child = spawn("pnpm", ["hardhat", "run", scriptPath, "--network", network], {
        stdio: "inherit",
        shell: true,
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Script ${file} exited with code ${code}`));
        } else {
          console.log(chalk.green(`✅ ${dir}/${file} completed\n`));
          resolve();
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }

  console.log(`🎉 All scripts completed successfully!`);
}

main().catch((error) => {
  console.error("❌ Script execution failed:", error);
  process.exit(1);
});
