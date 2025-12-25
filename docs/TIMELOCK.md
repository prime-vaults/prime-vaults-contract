# PrimeTimelock Deployment Guide

## Overview

PrimeTimelock enforces a **48-hour delay on role changes** to prevent admin rug pulls.

**PRIMARY PURPOSE**: Control OWNER_ROLE in PrimeRBAC so admins can't instantly grant themselves unlimited power.

## Architecture

```
┌─────────────────┐
│   Multi-sig     │ (Proposers - can schedule role changes)
│   (3-of-5)      │
└────────┬────────┘
         │ proposes role grant/revoke
         ▼
┌─────────────────┐
│  PrimeTimelock  │ (48h delay - users can exit)
│   (OWNER_ROLE)  │
└────────┬────────┘
         │ executes after 48h
         ▼
┌─────────────────┐
│   PrimeRBAC     │ (Role management)
│ RolesAuthority  │
└─────────────────┘
```

**Why only role management?**

- Role changes = highest risk (can grant unlimited power)
- Fee/reward changes already have hard limits (max 20% fee, etc.)
- Pause mechanism exists for emergencies

## Deployment Steps

### 1. Prepare Multi-sig Addresses

First, deploy Gnosis Safe multi-sig wallets:

```bash
# Option A: Use Gnosis Safe UI
# Visit: https://app.safe.global/

# Option B: Use Safe CLI
npm install -g @safe-global/safe-cli
safe-creator --network mainnet
```

Recommended setup:

- **Proposer Multi-sig**: 3-of-5 (team members who can propose changes)
- **Admin Multi-sig**: 4-of-7 (emergency admin, can cancel operations)

**Important Parameters:**

- **minDelay**: Minimum delay in seconds (recommended: 172800 = 48 hours)
- **proposers**: Array of addresses that can propose operations (use multi-sig)
- **executors**: Array of addresses that can execute operations
  - Use `address(0)` to allow anyone to execute after delay
  - Or specify specific executor addresses
- **admin**: Address that can manage timelock roles
  - Should be renounced after setup for full decentralization

### 3. Deploy Timelock

Save the deployed timelock address from output.

### 4. Transfer OWNER_ROLE to Timelock

The timelock needs OWNER_ROLE to control role management.

```bash
# Get the role hash
OWNER_ROLE=$(cast keccak "OWNER_ROLE")

# Grant OWNER_ROLE to timelock
cast send $PRIME_RBAC_ADDRESS \
  "grantRole(bytes32,address)" \
  $OWNER_ROLE \
  $TIMELOCK_ADDRESS \
  --private-key $CURRENT_OWNER_KEY \
  --rpc-url $RPC_URL

# Revoke OWNER_ROLE from current owner (important!)
cast send $PRIME_RBAC_ADDRESS \
  "revokeRole(bytes32,address)" \
  $OWNER_ROLE \
  $CURRENT_OWNER_ADDRESS \
  --private-key $CURRENT_OWNER_KEY \
  --rpc-url $RPC_URL
```

### 5. Verify Timelock Setup

```bash
# Check min delay
cast call $TIMELOCK_ADDRESS "getMinDelay()" --rpc-url $RPC_URL

# Check if address has proposer role
PROPOSER_ROLE=$(cast call $TIMELOCK_ADDRESS "PROPOSER_ROLE()")
cast call $TIMELOCK_ADDRESS \
  "hasRole(bytes32,address)" \
  $PROPOSER_ROLE \
  $PROPOSER_MULTISIG \
  --rpc-url $RPC_URL

# Check if timelock has OWNER_ROLE
cast call $PRIME_RBAC_ADDRESS \
  "hasRole(bytes32,address)" \
  $OWNER_ROLE \
  $TIMELOCK_ADDRESS \
  --rpc-url $RPC_URL
# Should return: true
```

### 6. Test Timelock (IMPORTANT!)

Before renouncing admin, test role management through timelock on testnet:

```bash
# 1. Schedule operation to grant OPERATOR_ROLE to a test address
TEST_ADDRESS=0x1234567890123456789012345678901234567890

# Encode the grantRole call
GRANT_ROLE_DATA=$(cast calldata "grantRole(bytes32,address)" \
  "$(cast keccak 'OPERATOR_ROLE')" \
  $TEST_ADDRESS)

# Schedule the operation
cast send $TIMELOCK_ADDRESS \
  "schedule(address,uint256,bytes,bytes32,bytes32,uint256)" \
  $PRIME_RBAC_ADDRESS \
  0 \
  $GRANT_ROLE_DATA \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  "$(cast keccak 'salt')" \
  172800 \
  --from $PROPOSER_MULTISIG

# 2. Wait for delay period (48 hours)
# Use a shorter delay on testnet for faster testing (e.g., 300 seconds = 5 min)

# 3. Execute operation (anyone can execute after delay)
cast send $TIMELOCK_ADDRESS \
  "execute(address,uint256,bytes,bytes32,bytes32)" \
  $PRIME_RBAC_ADDRESS \
  0 \
  $GRANT_ROLE_DATA \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  "$(cast keccak 'salt')"

# 4. Verify role was granted
cast call $PRIME_RBAC_ADDRESS \
  "hasRole(bytes32,address)" \
  "$(cast keccak 'OPERATOR_ROLE')" \
  $TEST_ADDRESS \
  --rpc-url $RPC_URL
# Should return: true
```

### 7. Renounce Admin Role (Point of No Return!)

After successful testing, renounce the admin role to make the timelock fully decentralized.

⚠️ **WARNING**: This cannot be undone! After renouncing:

- Only the proposer multi-sig can schedule operations
- No one can modify timelock roles
- The system becomes truly decentralized

```bash
# Get admin role
DEFAULT_ADMIN_ROLE=$(cast call $TIMELOCK_ADDRESS "DEFAULT_ADMIN_ROLE()")

# Renounce admin (must be called by current admin)
cast send $TIMELOCK_ADDRESS \
  "revokeRole(bytes32,address)" \
  $DEFAULT_ADMIN_ROLE \
  $CURRENT_ADMIN_ADDRESS \
  --private-key $ADMIN_PRIVATE_KEY \
  --rpc-url $RPC_URL

# Verify admin role was renounced
cast call $TIMELOCK_ADDRESS \
  "hasRole(bytes32,address)" \
  $DEFAULT_ADMIN_ROLE \
  $CURRENT_ADMIN_ADDRESS \
  --rpc-url $RPC_URL
# Should return: false
```

## Usage Examples

### Schedule Grant Role

```bash
# Schedule granting PROTOCOL_ADMIN_ROLE to an address
ROLE_HASH=$(cast keccak "PROTOCOL_ADMIN_ROLE")
NEW_ADMIN=0xYourNewAdminAddress

# Encode call data
CALLDATA=$(cast calldata "grantRole(bytes32,address)" $ROLE_HASH $NEW_ADMIN)

# Schedule operation (from proposer multi-sig)
cast send $TIMELOCK_ADDRESS \
  "schedule(address,uint256,bytes,bytes32,bytes32,uint256)" \
  $PRIME_RBAC_ADDRESS \
  0 \
  $CALLDATA \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  "$(cast keccak 'my-unique-salt')" \
  172800 \
  --from $PROPOSER_MULTISIG

# Wait 48 hours...

# Execute (anyone can execute)
cast send $TIMELOCK_ADDRESS \
  "execute(address,uint256,bytes,bytes32,bytes32)" \
  $PRIME_RBAC_ADDRESS \
  0 \
  $CALLDATA \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  "$(cast keccak 'my-unique-salt')"
```

### Schedule Revoke Role

```bash
# Schedule revoking OPERATOR_ROLE from an address
ROLE_HASH=$(cast keccak "OPERATOR_ROLE")
OLD_OPERATOR=0xAddressToRevoke

CALLDATA=$(cast calldata "revokeRole(bytes32,address)" $ROLE_HASH $OLD_OPERATOR)

cast send $TIMELOCK_ADDRESS \
  "schedule(address,uint256,bytes,bytes32,bytes32,uint256)" \
  $PRIME_RBAC_ADDRESS \
  0 \
  $CALLDATA \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  "$(cast keccak 'revoke-salt')" \
  172800 \
  --from $PROPOSER_MULTISIG
```

### Cancel Operation

Only proposer or admin can cancel:

```bash
# Get operation ID from events or calculate it
OPERATION_ID=$(cast call $TIMELOCK_ADDRESS \
  "hashOperation(address,uint256,bytes,bytes32,bytes32)" \
  $TARGET $VALUE $CALLDATA $PREDECESSOR $SALT)

# Cancel
cast send $TIMELOCK_ADDRESS \
  "cancel(bytes32)" \
  $OPERATION_ID \
  --from $PROPOSER_MULTISIG
```

## Emergency Procedures

### Cancel Malicious Operation

If a malicious operation is scheduled:

```bash
# 1. Get operation ID from events
cast logs --address $TIMELOCK_ADDRESS --from-block $BLOCK_NUMBER

# 2. Cancel from proposer multi-sig
cast send $TIMELOCK_ADDRESS \
  "cancel(bytes32)" \
  $OPERATION_ID \
  --from $PROPOSER_MULTISIG
```

### Pause Entire Protocol

If immediate action is needed:

```bash
# Pause via current PROTOCOL_ADMIN (might not be timelock in emergency)
cast send $ACCOUNTANT_ADDRESS \
  "pause()" \
  --from $PROTOCOL_ADMIN
```

## Security Checklist

Before going to production:

- [ ] Multi-sig wallets deployed and tested
- [ ] All signers have access to their keys
- [ ] Timelock deployed with correct parameters
- [ ] PROTOCOL_ADMIN_ROLE granted to timelock
- [ ] Test operation scheduled and executed successfully
- [ ] All critical contracts use timelock for admin operations
- [ ] Emergency procedures documented and tested
- [ ] Admin role renounced (after thorough testing)
- [ ] Monitoring and alerting set up for timelock events

## Monitoring

Monitor these events:

```solidity
// OpenZeppelin TimelockController events
event CallScheduled(bytes32 indexed id, ...);
event CallExecuted(bytes32 indexed id, ...);
event Cancelled(bytes32 indexed id);
```

Set up alerts for:

- Any scheduled operations (immediate notification)
- Operations nearing execution time (24h warning)
- Cancelled operations (security alert)

## References

- [OpenZeppelin TimelockController](https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController)
- [Gnosis Safe Documentation](https://docs.safe.global/)
- [Timelock Best Practices](https://blog.openzeppelin.com/protect-your-users-with-smart-contract-timelocks)

---

**Last Updated**: 2025-12-19 **Audit Reference**: Issue #8 - Centralization Risk (SALUS Security Audit)
