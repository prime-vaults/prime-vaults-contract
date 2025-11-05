#!/usr/bin/env tsx
import chalk from "chalk";
import { spawn } from "child_process";
import { defineCommand, runMain } from "citty";
import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = defineCommand({
  meta: {
    name: "run",
    description: "Run deployment scripts in order",
  },
  args: {
    dir: {
      type: "string",
      description: "Directory containing scripts to run",
      required: true,
    },
    network: {
      type: "string",
      description: "Network to deploy to",
      required: true,
    },
    f: {
      type: "string",
      description: "Specific files to run (comma-separated)",
      required: false,
    },
  },
  async run({ args }) {
    const { dir, network, f } = args;

    console.log(`🚀 Starting script to network: ${network}\n`);

    // Read all scripts from the <dir> directory
    const deployDir = path.join(__dirname, "../", dir);
    const files = readdirSync(deployDir)
      .filter((file) => file.endsWith(".ts") && (f ? file.includes(f) : true))
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
  },
});

runMain(main);
