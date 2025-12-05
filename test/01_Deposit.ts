import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { DEPOSIT_AMOUNT, DEPOSIT_CAP, ONE_TOKEN, depositTokens, initializeTest } from "./utils.js";

void describe("01_Deposit", function () {
  /**
   * Scenario 1: Basic deposit flow for a user.
   *
   * Step 1 (At T0):
   *  - Alice approves vault to spend 100 tokens.
   *  - Alice deposits 100 tokens.
   *  - Vault mints 100 shares (1:1 ratio on first deposit).
   *
   * Expected outcome:
   *  - Alice receives shares equal to deposit amount.
   *  - Alice's token balance decreases by deposit amount.
   *  - Vault holds the deposited tokens.
   */
  void describe("Basic Deposit Flow", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Alice deposits 100 tokens", async function () {
      const { alice } = context;
      const depositAmount = DEPOSIT_AMOUNT;

      const result = await depositTokens(context, depositAmount, alice.account);

      assert.equal(result.shares, depositAmount, "Shares should equal deposit amount on first deposit");
      assert.equal(result.balanceAfter, result.initialBalance - depositAmount, "Balance should decrease by deposit amount");
    });
  });

  /**
   * Scenario 2: Vault deposit cap enforcement.
   * Cap = 200 tokens (DEPOSIT_CAP)
   * Alice balance: 100 tokens
   * Bob balance: 100 tokens
   *
   * Step 1 (At T0):
   *  - Admin sets deposit cap to 200 tokens.
   *  - Cap limits total vault shares to prevent over-allocation.
   *
   * Step 2:
   *  - Alice deposits 100 tokens (all her balance).
   *  - Total supply: 100 tokens.
   *  - Remaining cap: 100 tokens.
   *  - Alice balance: 0 tokens.
   *
   * Step 3:
   *  - Bob deposits 50 tokens.
   *  - Total supply: 150 tokens.
   *  - Remaining cap: 50 tokens.
   *  - Bob balance: 50 tokens.
   *
   * Step 4:
   *  - Bob attempts to deposit remaining 50 tokens but sends 100.
   *  - Transaction reverts: TellerWithMultiAssetSupport__DepositExceedsCap.
   *  - Would exceed cap (150 + 100 > 200).
   *
   * Step 5:
   *  - Bob deposits exactly 50 tokens (fills cap completely).
   *  - Total supply: 200 tokens (cap reached).
   *  - Bob balance: 0 tokens.
   *
   * Step 6:
   *  - Alice attempts to deposit 1 token.
   *  - Transaction reverts: cap already reached.
   *
   * Step 7:
   *  - Admin increases cap to 250 tokens.
   *  - Alice deposits 50 tokens (minted for test).
   *  - Total supply: 250 tokens (cap reached again).
   *  - Remaining cap: 0 tokens.
   *
   * Expected outcome:
   *  - Deposit cap prevents vault from accepting deposits beyond limit.
   *  - Users can only deposit up to remaining cap.
   *  - Admin can adjust cap dynamically.
   */
  void describe("Deposit Cap Enforcement", function () {
    let context: Awaited<ReturnType<typeof initializeTest>>;

    before(async function () {
      context = await initializeTest();
    });

    void it("Step 1: Admin sets deposit cap to 200 tokens", async function () {
      const { teller } = context;

      await teller.write.setDepositCap([DEPOSIT_CAP]);

      const tellerState = await teller.read.tellerState();
      // TellerState: [allowDeposits, allowWithdraws, permissionedTransfers, shareLockPeriod, depositCap]
      assert.equal(tellerState[4], DEPOSIT_CAP, "Deposit cap should be set to 200 tokens");
    });

    void it("Step 2: Alice deposits 100 tokens", async function () {
      const { vault, alice } = context;

      const result = await depositTokens(context, DEPOSIT_AMOUNT, alice.account);

      assert.equal(result.shares, DEPOSIT_AMOUNT, "Alice should receive 100 shares");

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, DEPOSIT_AMOUNT, "Total supply should be 100 tokens");
    });

    void it("Step 3: Bob deposits 50 tokens", async function () {
      const { vault, bob } = context;

      const depositAmount = 50n * ONE_TOKEN;

      const result = await depositTokens(context, depositAmount, bob.account);

      assert.equal(result.shares, depositAmount, "Bob should receive 50 shares");

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 150n * ONE_TOKEN, "Total supply should be 150 tokens");
    });

    void it("Step 4: Bob attempts to deposit 100 tokens (exceeds cap)", async function () {
      const { mockERC20, teller, bob } = context;

      const depositAmount = 100n * ONE_TOKEN;

      await mockERC20.write.approve([teller.address, depositAmount], { account: bob.account });

      await assert.rejects(
        async () => {
          await teller.write.deposit([depositAmount, depositAmount, bob.account.address], {
            account: bob.account,
          });
        },
        {
          name: "ContractFunctionExecutionError",
        },
        "Deposit should revert when exceeding cap",
      );
    });

    void it("Step 5: Bob deposits exactly 50 tokens (fills cap)", async function () {
      const { vault, bob } = context;

      const depositAmount = 50n * ONE_TOKEN;

      const sharesBefore = await vault.read.balanceOf([bob.account.address]);

      await depositTokens(context, depositAmount, bob.account);

      const sharesAfter = await vault.read.balanceOf([bob.account.address]);
      const sharesReceived = sharesAfter - sharesBefore;

      assert.equal(sharesReceived, depositAmount, "Bob should receive 50 shares");

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, DEPOSIT_CAP, "Total supply should be 200 tokens (cap reached)");
    });

    void it("Step 6: Alice attempts to deposit 1 token (cap already reached)", async function () {
      const { mockERC20, teller, alice } = context;

      const depositAmount = 1n * ONE_TOKEN;

      // Mint additional token for Alice
      await mockERC20.write.mint([alice.account.address, depositAmount]);

      await mockERC20.write.approve([teller.address, depositAmount], { account: alice.account });

      await assert.rejects(
        async () => {
          await teller.write.deposit([depositAmount, depositAmount, alice.account.address], {
            account: alice.account,
          });
        },
        {
          name: "ContractFunctionExecutionError",
        },
        "Deposit should revert when cap is already reached",
      );
    });

    void it("Step 7: Admin increases cap to 250 tokens, Alice deposits 50 more", async function () {
      const { teller, vault, alice, mockERC20 } = context;

      const newCap = 250n * ONE_TOKEN;
      await teller.write.setDepositCap([newCap]);

      const tellerState = await teller.read.tellerState();
      // TellerState: [allowDeposits, allowWithdraws, permissionedTransfers, shareLockPeriod, depositCap]
      assert.equal(tellerState[4], newCap, "Deposit cap should be increased to 250 tokens");

      // Mint 50 tokens for Alice
      const depositAmount = 50n * ONE_TOKEN;
      await mockERC20.write.mint([alice.account.address, depositAmount]);

      const sharesBefore = await vault.read.balanceOf([alice.account.address]);

      await depositTokens(context, depositAmount, alice.account);

      const sharesAfter = await vault.read.balanceOf([alice.account.address]);
      const sharesReceived = sharesAfter - sharesBefore;

      assert.equal(sharesReceived, depositAmount, "Alice should receive 50 shares");

      const totalSupply = await vault.read.totalSupply();
      assert.equal(totalSupply, 250n * ONE_TOKEN, "Total supply should be 250 tokens");
    });
  });
});
