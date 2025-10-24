import chalk from "chalk";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

interface ContractSize {
  name: string;
  size: number;
  sizeKB: string;
}

function getContractSizes(dir: string, contractSizes: ContractSize[] = []): ContractSize[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getContractSizes(filePath, contractSizes);
    } else if (file.endsWith(".json") && file !== "artifacts.d.ts") {
      try {
        const content = readFileSync(filePath, "utf-8");
        const artifact = JSON.parse(content);

        if (artifact.bytecode && artifact.bytecode !== "0x") {
          const bytecodeSize = (artifact.bytecode.length - 2) / 2; // Remove '0x' and divide by 2
          contractSizes.push({
            name: artifact.contractName || file.replace(".json", ""),
            size: bytecodeSize,
            sizeKB: (bytecodeSize / 1024).toFixed(2),
          });
        }
      } catch {
        // Skip invalid JSON files
      }
    }
  }

  return contractSizes;
}

function main() {
  const artifactsDir = join(process.cwd(), "artifacts", "contracts");

  try {
    const contractSizes = getContractSizes(artifactsDir);

    // Sort by size descending
    contractSizes.sort((a, b) => b.size - a.size);

    console.log(chalk.cyan("\n┌─────────────────────────────────────────────────────────────┐"));
    console.log(
      chalk.cyan("│") +
        chalk.bold.white("                     Contract Sizes                          ") +
        chalk.cyan("│"),
    );
    console.log(chalk.cyan("├─────────────────────────────────────────────────────────────┤"));
    console.log(
      chalk.cyan("│") + chalk.bold(" Contract Name                    │ Size (KB) │ Size (bytes) ") + chalk.cyan("│"),
    );
    console.log(chalk.cyan("├──────────────────────────────────┼───────────┼──────────────┤"));

    for (const contract of contractSizes) {
      const maxSize = 24576; // 24 KB limit
      const isOverLimit = contract.size > maxSize;
      const warning = isOverLimit ? chalk.red.bold(" ⚠️  EXCEEDS LIMIT") : "";

      const contractName = isOverLimit ? chalk.red(contract.name.padEnd(32)) : chalk.green(contract.name.padEnd(32));
      const sizeKB = isOverLimit ? chalk.red(contract.sizeKB.padStart(9)) : chalk.yellow(contract.sizeKB.padStart(9));
      const sizeBytes = isOverLimit
        ? chalk.red(contract.size.toString().padStart(12))
        : chalk.blue(contract.size.toString().padStart(12));

      console.log(
        chalk.cyan("│ ") +
          contractName +
          chalk.cyan(" │ ") +
          sizeKB +
          chalk.cyan(" │ ") +
          sizeBytes +
          chalk.cyan(" │") +
          warning,
      );
    }

    console.log(chalk.cyan("└──────────────────────────────────┴───────────┴──────────────┘"));
    console.log(chalk.bold(`\n📊 Total contracts: ${chalk.green(contractSizes.length.toString())}`));
    console.log(chalk.gray("Maximum contract size: 24.00 KB (24576 bytes)\n"));
  } catch {
    console.error(chalk.red.bold("❌ Error: Could not find artifacts. Please compile contracts first."));
    console.error(chalk.yellow("Run: ") + chalk.cyan("pnpm compile"));
    process.exit(1);
  }
}

main();
