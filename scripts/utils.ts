import chalk from "chalk";
import hre from "hardhat";
import prompts from "prompts";

import { readParams } from "../ignition/parameters/utils.js";

export async function runHardhatCmd(script: string) {
  if (!process.argv.includes(script)) return;

  const connection = await hre.network.connect();
  const networkName = connection.networkName;

  console.log(`📡 Running on network: ${chalk.blue(networkName)}\n`);
  const confirmNetwork = await prompts({
    type: "confirm",
    name: "value",
    message: `Run  ${chalk.green(script)} on network ${chalk.blue(networkName)}?`,
    initial: true,
  });

  if (confirmNetwork.value === undefined) {
    console.log("❌ Operation cancelled");
    process.exit(0);
  }

  if (!confirmNetwork.value) {
    console.log("❌ Deployment cancelled");
    process.exit(0);
  }

  const parameters = await prompts({
    type: "text",
    name: "value",
    message: "Enter parameters ID:",
  });

  if (!parameters.value || parameters.value === undefined) {
    console.log("❌ Parameters ID is required");
    process.exit(1);
  }

  const parametersData = readParams(parameters.value);
  if (parametersData.$global.network !== networkName) {
    console.log(
      `❌ Parameters network ( ${chalk.blue(parametersData.$global.network)}) does not match selected network (${chalk.blue(networkName)})`,
    );
    process.exit(0);
  }

  return { parameters: parameters.value, connection, networkName };
}
