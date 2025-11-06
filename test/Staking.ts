import { network } from "hardhat";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import MockERc20Module from "../ignition/modules/MockERC20.js";
import RolesAuthorityModule from "../ignition/modules/RolesAuthority.js";
import TellerModule from "../ignition/modules/Teller.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

void describe("Staking", function () {
  let mockERC20Address: `0x${string}`;
  let deployerAddress: `0x${string}`;

  const params = {
    $global: {
      adminAddress: ZERO_ADDRESS,
      wrapNative: ZERO_ADDRESS,
      tokenAddress: ZERO_ADDRESS,
    },
    VaultModule: {
      name: "Prime USD",
      symbol: "pUSD",
      decimals: "18",
    },
    AccountantModule: {
      startingExchangeRate: "1000000000000000000",
      allowedExchangeRateChangeUpper: 10010,
      allowedExchangeRateChangeLower: 9990,
      minimumUpdateDelayInSeconds: 1,
      platformFee: 200,
      performanceFee: 0,
    },
  };

  before(async () => {
    const { viem } = await network.connect();
    const [_deployer] = await viem.getWalletClients();
    deployerAddress = _deployer.account.address;
    params.$global.adminAddress = deployerAddress;

    // Deploy MockERC20 once
  });

  void it("Should deploy MockERC20 token", async function () {
    const { ignition } = await network.connect();

    const { mockERC20 } = await ignition.deploy(MockERc20Module);
    mockERC20Address = mockERC20.address;
    params.$global.tokenAddress = mockERC20Address;

    await mockERC20.write.mint([deployerAddress, 10n ** 18n]);
    assert.ok(mockERC20Address, "MockERC20 should be deployed");
  });

  void it("Should stake", async function () {
    const { ignition } = await network.connect();
    const { teller, accountant, vault } = await ignition.deploy(TellerModule, { parameters: params, displayUi: true });
    const { rolesAuthority, primeVaultFactory } = await ignition.deploy(RolesAuthorityModule, {
      parameters: params,
      displayUi: true,
    });

    await teller.write.setAuthority([rolesAuthority.address]);
    await accountant.write.setAuthority([rolesAuthority.address]);
    await vault.write.setAuthority([rolesAuthority.address]);
    await primeVaultFactory.write.setup([rolesAuthority.address, vault.address, accountant.address, teller.address]);

    const { mockERC20 } = await ignition.deploy(MockERc20Module);
    await mockERC20.write.approve([vault.address, 10n ** 18n]);

    const stakeTx = await teller.write.deposit([10n ** 18n, 0n, ZERO_ADDRESS]);

    const balance = await vault.read.balanceOf([deployerAddress]);
    console.log("Staked balance:", balance);
  });
});
