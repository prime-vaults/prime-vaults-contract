import { network } from "hardhat";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { getAddress, parseEther } from "viem";

void describe("Staking", function () {
  let viem: any;
  let _deployer: any; // unused on purpose
  let user: any;

  before(async () => {
    ({ viem } = await network.connect());
    [_deployer, user] = await viem.getWalletClients();
  });

  void it("Should deploy MockERC20 token", async function () {
    const token = await viem.deployContract("MockERC20", ["Test Token", "TEST", 18]);

    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const decimals = await token.read.decimals();

    assert.equal(name, "Test Token");
    assert.equal(symbol, "TEST");
    assert.equal(decimals, 18);
  });

  void it("Should stake tokens successfully", async function () {
    // Deploy token
    const token = await viem.deployContract("MockERC20", ["Test Token", "TEST", 18]);

    // Deploy staking contract
    const staking = await viem.deployContract("Staking", [token.address]);

    // Mint tokens to user
    const mintAmount = parseEther("100");
    await token.write.mint([user.account.address, mintAmount]);

    // Check user balance
    const userBalance = await token.read.balanceOf([user.account.address]);
    assert.equal(userBalance, mintAmount);

    // Approve staking contract
    const stakeAmount = parseEther("50");
    await token.write.approve([staking.address, stakeAmount], { account: user.account });

    // Stake tokens
    await staking.write.stake([stakeAmount], { account: user.account });

    // Verify stake
    const stakedAmount = await staking.read.stakes([user.account.address]);
    assert.equal(stakedAmount, stakeAmount);

    // Verify token was transferred
    const stakingBalance = await token.read.balanceOf([staking.address]);
    assert.equal(stakingBalance, stakeAmount);
  });

  void it("Should emit Staked event when staking", async function () {
    // Deploy token
    const token = await viem.deployContract("MockERC20", ["Test Token", "TEST", 18]);

    // Deploy staking contract
    const staking = await viem.deployContract("Staking", [token.address]);

    // Mint and approve tokens
    const stakeAmount = parseEther("50");
    await token.write.mint([user.account.address, stakeAmount]);
    await token.write.approve([staking.address, stakeAmount], { account: user.account });

    // Check Staked event
    await viem.assertions.emitWithArgs(
      staking.write.stake([stakeAmount], { account: user.account }),
      staking,
      "Staked",
      [getAddress(user.account.address), stakeAmount],
    );
  });
});
