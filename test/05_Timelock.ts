import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { encodeAbiParameters, keccak256, toHex } from "viem";

import { initializeTest } from "./utils.js";

void describe("PrimeTimelock", () => {
  let context: Awaited<ReturnType<typeof initializeTest>>;

  before(async () => {
    context = await initializeTest();
  });

  void describe("Deployment", () => {
    void it("should deploy timelock with correct configuration", async () => {
      const { timelock, deployer } = context;

      // Check min delay (48 hours)
      const minDelay = await timelock.read.getMinDelay();
      assert.equal(minDelay, 172800n);

      // Check roles
      const PROPOSER_ROLE = await timelock.read.PROPOSER_ROLE();
      const EXECUTOR_ROLE = await timelock.read.EXECUTOR_ROLE();
      const DEFAULT_ADMIN_ROLE = await timelock.read.DEFAULT_ADMIN_ROLE();

      // Deployer should be proposer
      const isProposer = await timelock.read.hasRole([PROPOSER_ROLE, deployer.account.address]);
      assert.equal(isProposer, true);

      // Deployer should be admin
      const isAdmin = await timelock.read.hasRole([DEFAULT_ADMIN_ROLE, deployer.account.address]);
      assert.equal(isAdmin, true);

      // address(0) should be executor (anyone can execute)
      const isExecutor = await timelock.read.hasRole([EXECUTOR_ROLE, "0x0000000000000000000000000000000000000000"]);
      assert.equal(isExecutor, true);
    });

    void it("should have OWNER_ROLE transferred to timelock", async () => {
      const { timelock, primeRBAC, deployer } = context;
      const OWNER_ROLE = await primeRBAC.read.OWNER_ROLE();

      // Timelock should have OWNER_ROLE
      const timelockHasOwner = await primeRBAC.read.hasRole([OWNER_ROLE, timelock.address]);
      assert.equal(timelockHasOwner, true);

      // Deployer should NOT have OWNER_ROLE
      const deployerHasOwner = await primeRBAC.read.hasRole([OWNER_ROLE, deployer.account.address]);
      assert.equal(deployerHasOwner, false);
    });
  });

  void describe("Role Management via Timelock", () => {
    void it("should schedule and execute role grant after delay", async () => {
      const { timelock, primeRBAC, deployer, alice, networkHelpers } = context;

      // Get role hash
      const PROTOCOL_ADMIN_ROLE = await primeRBAC.read.PROTOCOL_ADMIN_ROLE();

      // Alice should not have PROTOCOL_ADMIN_ROLE initially
      let hasRole = await primeRBAC.read.hasRole([PROTOCOL_ADMIN_ROLE, alice.account.address]);
      assert.equal(hasRole, false);

      // Prepare call data for grantRole
      const grantRoleData = encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [PROTOCOL_ADMIN_ROLE, alice.account.address]);

      const calldata = ("0x2f2ff15d" + grantRoleData.slice(2)) as `0x${string}`; // grantRole selector + args

      // Calculate operation ID
      const salt = keccak256(toHex("test-salt"));
      const predecessor = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      const operationId = await timelock.read.hashOperation([primeRBAC.address, 0n, calldata, predecessor, salt]);

      // Schedule operation
      const scheduleTx = await timelock.write.schedule([primeRBAC.address, 0n, calldata, predecessor, salt, 172800n], {
        account: deployer.account,
      });

      await context.client.waitForTransactionReceipt({ hash: scheduleTx });

      // Operation should be pending
      const isPending = await timelock.read.isOperationPending([operationId]);
      assert.equal(isPending, true);

      // Try to execute before delay - should fail
      await assert.rejects(async () => {
        await timelock.write.execute([primeRBAC.address, 0n, calldata, predecessor, salt], {
          account: deployer.account,
        });
      });

      // Fast forward time by 48 hours
      await networkHelpers.time.increase(172801n);

      // Now operation should be ready
      const isReady = await timelock.read.isOperationReady([operationId]);
      assert.equal(isReady, true);

      // Execute operation (anyone can execute since executor is address(0))
      const executeTx = await timelock.write.execute([primeRBAC.address, 0n, calldata, predecessor, salt], {
        account: deployer.account,
      });

      await context.client.waitForTransactionReceipt({ hash: executeTx });

      // Alice should now have PROTOCOL_ADMIN_ROLE
      hasRole = await primeRBAC.read.hasRole([PROTOCOL_ADMIN_ROLE, alice.account.address]);
      assert.equal(hasRole, true);
    });

    void it("should allow proposer to cancel pending operation", async () => {
      const { timelock, primeRBAC, deployer, alice } = context;

      const PROTOCOL_ADMIN_ROLE = await primeRBAC.read.PROTOCOL_ADMIN_ROLE();
      const grantData = encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [PROTOCOL_ADMIN_ROLE, alice.account.address]);
      const calldata = ("0x2f2ff15d" + grantData.slice(2)) as `0x${string}`;
      const salt = keccak256(toHex("cancel-test"));
      const predecessor = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      // Schedule operation
      await timelock.write.schedule([primeRBAC.address, 0n, calldata, predecessor, salt, 172800n], {
        account: deployer.account,
      });

      const operationId = await timelock.read.hashOperation([primeRBAC.address, 0n, calldata, predecessor, salt]);

      // Operation should be pending
      let isPending = await timelock.read.isOperationPending([operationId]);
      assert.equal(isPending, true);

      // Cancel operation
      const cancelTx = await timelock.write.cancel([operationId], {
        account: deployer.account,
      });

      await context.client.waitForTransactionReceipt({ hash: cancelTx });

      // Operation should no longer be pending
      isPending = await timelock.read.isOperationPending([operationId]);
      assert.equal(isPending, false);
    });

    void it("should prevent non-proposer from scheduling operations", async () => {
      const { timelock, primeRBAC, alice } = context;

      const PROTOCOL_ADMIN_ROLE = await primeRBAC.read.PROTOCOL_ADMIN_ROLE();
      const grantData = encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [PROTOCOL_ADMIN_ROLE, alice.account.address]);
      const calldata = ("0x2f2ff15d" + grantData.slice(2)) as `0x${string}`;
      const salt = keccak256(toHex("unauthorized"));
      const predecessor = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      // Alice is not proposer, should fail
      await assert.rejects(async () => {
        await timelock.write.schedule([primeRBAC.address, 0n, calldata, predecessor, salt, 172800n], {
          account: alice.account,
        });
      });
    });

    void it("should prevent direct OWNER_ROLE grant without timelock", async () => {
      const { primeRBAC, deployer, alice } = context;

      const OWNER_ROLE = await primeRBAC.read.OWNER_ROLE();

      // Deployer no longer has OWNER_ROLE, so direct grant of OWNER_ROLE should fail
      await assert.rejects(async () => {
        await primeRBAC.write.grantRole([OWNER_ROLE, alice.account.address], { account: deployer.account });
      });
    });
  });

  void describe("Security", () => {
    void it("should enforce minimum delay", async () => {
      const { timelock } = context;

      const minDelay = await timelock.read.getMinDelay();
      assert.equal(minDelay, 172800n); // 48 hours
    });

    void it("should prevent execution before delay expires", async () => {
      const { timelock, primeRBAC, deployer, alice, networkHelpers } = context;

      const PROTOCOL_ADMIN_ROLE = await primeRBAC.read.PROTOCOL_ADMIN_ROLE();
      const grantData = encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [PROTOCOL_ADMIN_ROLE, alice.account.address]);
      const calldata = ("0x2f2ff15d" + grantData.slice(2)) as `0x${string}`;
      const salt = keccak256(toHex("early-execute"));
      const predecessor = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      // Schedule operation
      await timelock.write.schedule([primeRBAC.address, 0n, calldata, predecessor, salt, 172800n], {
        account: deployer.account,
      });

      // Try to execute immediately - should fail
      await assert.rejects(async () => {
        await timelock.write.execute([primeRBAC.address, 0n, calldata, predecessor, salt], {
          account: deployer.account,
        });
      });

      // Fast forward past the delay (172800 seconds)
      await networkHelpers.time.increase(172801n);

      const executeTx = await timelock.write.execute([primeRBAC.address, 0n, calldata, predecessor, salt], {
        account: deployer.account,
      });

      await context.client.waitForTransactionReceipt({ hash: executeTx });

      // Verify role was granted
      const hasRole = await primeRBAC.read.hasRole([PROTOCOL_ADMIN_ROLE, alice.account.address]);
      assert.equal(hasRole, true);
    });
  });
});
