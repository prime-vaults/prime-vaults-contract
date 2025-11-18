import { network } from "hardhat";
import { Account } from "viem";

import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeVault from "../scripts/deploy/01_primeVault.js";

export const ONE_DAY_SECS = 24n * 60n * 60n;
export const ONE_TOKEN = 10n ** 18n;
export const PARAMETERS_ID = "localhost-usd";

export async function initializeTest() {
  const connection = await network.connect();
  const [deployer, alice, bob] = await connection.viem.getWalletClients();

  // Deploy mocks
  const mocks = await deployMocks(connection, PARAMETERS_ID);

  // Mint tokens to deployer
  await mocks.mockERC20.write.mint([deployer.account.address, 10000n * 10n ** 18n]);
  await mocks.mockERC20.write.mint([alice.account.address, 10000n * 10n ** 18n]);
  await mocks.mockERC20.write.mint([bob.account.address, 10000n * 10n ** 18n]);

  // Deploy full system (vault + accountant + teller + manager)
  const primeModules = await deployPrimeVault(connection, PARAMETERS_ID, {
    stakingToken: mocks.mockERC20.address,
    primeStrategistAddress: mocks.mockStrategist.address,
  });

  return {
    deployer,
    alice,
    bob,
    connection,
    networkHelpers: connection.networkHelpers,
    ...mocks,
    ...primeModules,
  };
}

/**
 * Helper function to approve and deposit tokens
 * @param context - Test context from initializeTest()
 * @param depositAmount - Amount to deposit (in wei)
 * @returns Object containing shares received and balance changes
 */
export async function depositTokens(
  context: Awaited<ReturnType<typeof initializeTest>>,
  depositAmount: bigint,
  account?: Account,
) {
  const { mockERC20, vault, teller } = context;
  if (!account) account = context.deployer.account;

  const initialBalance = await mockERC20.read.balanceOf([account.address]);

  // Approve vault to spend tokens
  await mockERC20.write.approve([vault.address, depositAmount], { account });

  // Deposit tokens
  await teller.write.deposit([depositAmount, 0n, account.address], { account });

  const shares = await vault.read.balanceOf([account.address]);
  const balanceAfter = await mockERC20.read.balanceOf([account.address]);

  return {
    shares,
    initialBalance,
    balanceAfter,
    depositAmount,
  };
}

/**
 * Assert that a value is approximately equal to expected within a tolerance
 * @param actual - Actual value
 * @param expected - Expected value
 * @param message - Optional error message
 * @param tolerancePercent - Tolerance as percentage (default 1%)
 */
export function assertApproxEqual(actual: bigint, expected: bigint, message?: string, tolerancePercent = 1n) {
  const tolerance = (expected * tolerancePercent) / 100n;
  const min = expected - tolerance;
  const max = expected + tolerance;

  if (actual < min || actual > max) {
    const error = message || `Expected ${actual} to be approximately ${expected} (±${tolerancePercent}%)`;
    throw new Error(
      `${error}\n  Actual: ${actual}\n  Expected: ${expected}\n  Tolerance: ±${tolerance} (${tolerancePercent}%)`,
    );
  }
}
