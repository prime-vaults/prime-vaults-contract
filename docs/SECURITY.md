# Security Best Practices

## Centralization Risk Mitigation

### Overview
The Prime Vaults system uses a role-based access control (RBAC) system with privileged roles that have significant power over the protocol. To mitigate centralization risks, we strongly recommend implementing the following security measures.

### Privileged Roles

The following roles have critical permissions:

1. **OWNER_ROLE** (PrimeRBAC)
   - Can grant/revoke all roles
   - Highest privilege level
   - **Risk**: Complete control over the system

2. **PROTOCOL_ADMIN_ROLE** (via PrimeAuth)
   - Can update platform fees, payout addresses
   - Can pause/unpause contracts
   - Can set reward parameters
   - **Risk**: Can manipulate protocol economics

3. **OPERATOR_ROLE** (via PrimeAuth)
   - Can call `manage()` in BoringVault (execute arbitrary calls)
   - Can call `notifyRewardAmount()` in Distributor
   - **Risk**: Can drain vault assets or manipulate rewards

4. **STRATEGIST_ROLE** (ManagerWithMerkleVerification)
   - Can execute Merkle-verified vault management operations
   - **Risk**: Can move vault funds (with Merkle proof constraints)

### Recommended Security Measures

#### 1. Multi-Signature Wallets

**All privileged roles MUST be controlled by multi-signature wallets, NOT EOAs (Externally Owned Accounts).**

Recommended multi-sig configurations:
- **OWNER_ROLE**: 4-of-7 multi-sig (highest threshold)
- **PROTOCOL_ADMIN_ROLE**: 3-of-5 multi-sig
- **OPERATOR_ROLE**: 2-of-3 multi-sig (for operational flexibility with security)

Recommended multi-sig solutions:
- [Gnosis Safe](https://safe.global/) - Battle-tested, widely adopted
- [Safe{Core}](https://docs.safe.global/safe-core-aa-sdk/safe-core-sdk) - Programmable multi-sig

#### 2. Timelock for Role Management

**PRIMARY PURPOSE: Prevent admin rug pulls by adding 48h delay to role changes.**

Prime Vaults includes **PrimeTimelock** to control OWNER_ROLE:

```solidity
// Deploy PrimeTimelock
address[] memory proposers = new address[](1);
proposers[0] = multiSigAddress;

address[] memory executors = new address[](1);
executors[0] = address(0); // Anyone can execute after delay

PrimeTimelock timelock = new PrimeTimelock(
    172800,      // 48 hours minimum delay
    proposers,   // Multi-sig can propose
    executors,   // Anyone can execute
    msg.sender   // Temp admin (renounce after setup)
);

// Transfer OWNER_ROLE to timelock (prevents instant role changes)
primeRBAC.grantRole(OWNER_ROLE, address(timelock));
primeRBAC.revokeRole(OWNER_ROLE, currentOwner);

// Renounce admin (makes timelock fully decentralized)
timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), msg.sender);
```

**Why only role management needs timelock:**
- ✅ Role changes = highest risk (can grant themselves unlimited power)
- ✅ 48h delay gives users time to exit before malicious role grants
- ❌ Fee/reward changes DON'T need timelock because:
  - Already have hard limits (max 20% fee)
  - Business logic constraints prevent extreme values
  - Pause mechanism available for emergencies
  - Not instant rug pull vectors

📖 **See [TIMELOCK_DEPLOYMENT.md](./TIMELOCK_DEPLOYMENT.md) for deployment guide**

#### 3. Separation of Duties

**Never use the same multi-sig for multiple roles.**

Recommended structure:
```
OWNER_ROLE (4-of-7)
    └─ Emergency only (grant/revoke roles)

PROTOCOL_ADMIN_ROLE (3-of-5) + 48h Timelock
    └─ Economic parameters (fees, rewards)

OPERATOR_ROLE (2-of-3)
    └─ Daily operations (manage, notify rewards)
    └─ Merkle tree updates
```

#### 4. Emergency Pause Mechanism

The system includes pause functionality via `PrimeAuth.pause()`:
- Only PROTOCOL_ADMIN can pause
- Should be executed via emergency multi-sig
- Use for incident response

**Emergency Response Plan**:
1. Detect suspicious activity
2. Pause affected contracts immediately
3. Investigate root cause
4. Fix vulnerability
5. Audit fix
6. Unpause with announcement

#### 5. Monitoring and Alerting

**Implement real-time monitoring for privileged operations:**

Critical events to monitor:
```solidity
// BoringVault
event Paused(address indexed caller);
event Unpaused(address indexed caller);

// AccountantProviders
event PlatformFeeUpdated(uint16 oldFee, uint16 newFee);
event PayoutAddressUpdated(address oldPayout, address newPayout);

// Distributor
event RewardAdded(uint256 reward);
event RewardsDurationUpdated(address token, uint256 newDuration);

// PrimeRBAC
event RoleGranted(bytes32 indexed role, address indexed account);
event RoleRevoked(bytes32 indexed role, address indexed account);
```

Recommended monitoring tools:
- [OpenZeppelin Defender](https://www.openzeppelin.com/defender) - Automated monitoring and alerts
- [Tenderly](https://tenderly.co/) - Transaction monitoring and alerting
- Custom Discord/Telegram bots for event notifications

#### 6. Key Management

**Never store private keys in plain text or share them insecurely.**

Best practices:
- Use hardware wallets (Ledger, Trezor) for multi-sig signers
- Store recovery phrases in secure, geographically distributed locations
- Use MPC (Multi-Party Computation) wallets for enhanced security
- Regular key rotation for operational accounts

#### 7. Incident Response Playbook

**Prepare for the worst case scenario:**

1. **Detection Phase**
   - Automated alerts trigger
   - Manual anomaly detection
   - User reports

2. **Response Phase**
   - Activate emergency multi-sig
   - Pause affected contracts
   - Assess damage and attack vector

3. **Mitigation Phase**
   - Deploy fixes
   - Coordinate with affected users
   - Public communication

4. **Recovery Phase**
   - Unpause contracts
   - Post-mortem analysis
   - Implement preventive measures

### Deployment Checklist

Before going to production:

- [ ] All privileged roles transferred to multi-sig wallets
- [ ] Timelock controller deployed and configured
- [ ] Emergency multi-sig tested and verified
- [ ] Monitoring and alerting systems active
- [ ] Incident response team identified and trained
- [ ] Key management procedures documented
- [ ] Public disclosure of security measures
- [ ] Regular security audits scheduled

### Additional Recommendations

1. **Bug Bounty Program**: Incentivize security researchers to find vulnerabilities
2. **Regular Audits**: Schedule quarterly security audits as codebase evolves
3. **Insurance**: Consider smart contract insurance (Nexus Mutual, InsurAce)
4. **Gradual Rollout**: Start with limited TVL, increase gradually as security is proven

### References

- [Gnosis Safe Documentation](https://docs.safe.global/)
- [OpenZeppelin Timelock Controller](https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController)
- [Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Trail of Bits Security Patterns](https://github.com/crytic/building-secure-contracts)

---

**Audit Response**: This document addresses **Issue #8: Centralization Risk** from the SALUS security audit (Dec 2025). While the code itself is designed with appropriate role separation, operational security requires proper deployment practices as outlined above.
