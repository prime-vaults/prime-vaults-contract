import { network } from "hardhat";
import { Account } from "viem";

import deployMocks from "../scripts/deploy/00_mock.js";
import deployPrimeRegistry from "../scripts/deploy/01_primeRegistry.js";
import deployBoringVault from "../scripts/deploy/02.1_boringVault.js";
import deployAccountant from "../scripts/deploy/02.2_accountant.js";
import deployTeller from "../scripts/deploy/02.3_teller.js";
import deployTellerHelper from "../scripts/deploy/02.4_tellerHelper.js";
import deployWithdrawer from "../scripts/deploy/02.5_withdrawer.js";
import deployPrimeManager from "../scripts/deploy/03_vaultManager.js";
import deployDistributor from "../scripts/deploy/04_distributor.js";

export const ONE_DAY_SECS = 24n * 60n * 60n;
export const ONE_TOKEN = 10n ** 18n;
export const PARAMETERS_ID = "localhost-usd";
export const DEPOSIT_CAP = 200n * ONE_TOKEN;
export const DEPOSIT_AMOUNT = 100n * ONE_TOKEN;

export async function initializeTest() {
  const connection = await network.connect();
  const [deployer, alice, bob] = await connection.viem.getWalletClients();

  // Deploy mocks
  const mocks = await deployMocks(connection, PARAMETERS_ID);

  // Mint tokens: deployer for rewards, alice/bob for deposits (100 tokens each)
  await mocks.mockERC20.write.mint([deployer.account.address, 1000n * ONE_TOKEN]);
  await mocks.mockERC20.write.mint([alice.account.address, DEPOSIT_AMOUNT]);
  await mocks.mockERC20.write.mint([bob.account.address, DEPOSIT_AMOUNT]);

  // Deploy full system (vault + accountant + teller + manager)
  await deployPrimeRegistry(connection, PARAMETERS_ID, false);
  const boringVault = await deployBoringVault(connection, PARAMETERS_ID);
  const accountant = await deployAccountant(connection, PARAMETERS_ID);
  const teller = await deployTeller(connection, PARAMETERS_ID);
  const tellerHelper = await deployTellerHelper(connection, PARAMETERS_ID);
  const withdrawer = await deployWithdrawer(connection, PARAMETERS_ID);
  const managerModules = await deployPrimeManager(connection, PARAMETERS_ID);
  const distributor = await deployDistributor(connection, PARAMETERS_ID);

  return {
    ...mocks,
    ...boringVault,
    ...accountant,
    ...teller,
    ...tellerHelper,
    ...withdrawer,
    ...managerModules,
    ...distributor,
    deployer,
    alice,
    bob,
    connection,
    networkHelpers: connection.networkHelpers,
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
