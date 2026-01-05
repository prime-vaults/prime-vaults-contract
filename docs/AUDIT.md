# Prime Vaults - Security Audits

## Overview

Prime Vaults has been audited by multiple independent security firms to ensure the safety and integrity of the protocol.

## Audit Reports

| Auditor | Date | Status | Report |
|---------|------|--------|--------|
| **Salus Security** | December 2025 | Completed | [View Report](https://github.com/Salusec/Salus-audit/blob/main/2025/Prime-vault_audit_report_2025-12-22.pdf) |
| **Shieldify** | December 2025 | Completed | [View Report](https://github.com/shieldify-security/audits-portfolio/blob/main/reports/Prime-Vaults-Security-Review.pdf) |

---

## Salus Security Audit (December 2025)

### Project Summary

- **Name:** Prime Vault
- **Platform:** EVM-compatible chains
- **Language:** Solidity
- **Audit Date:** December 18, 2025

### Vulnerability Summary

| Severity | Count |
|----------|-------|
| High | 3 |
| Medium | 5 |
| Low | 1 |
| Informational | 1 |
| **Total** | **10** |

### Findings Summary

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| 1 | Delay withdrawal will be blocked | High | Fixed |
| 2 | Users' shares may be locked forever | High | Fixed |
| 3 | Users may lose their expected rewards | High | Fixed |
| 4 | Missing claim rewards in delayed withdraw | Medium | Fixed |
| 5 | Compound rewards will extend the lock time | Medium | Fixed |
| 6 | Platform fees may be rounded down to 0 | Medium | Fixed |
| 7 | Later depositors will have advantage in the same reward period | Medium | Acknowledged |
| 8 | Centralization risk | Medium | Mitigated |
| 9 | Missing validation for buffer helper | Low | Fixed |
| 10 | Redundant code | Informational | Fixed |

### Notable Findings & Resolutions

#### 1. Delay withdrawal will be blocked (High)
**Issue:** In DelayedWithdraw, `minimumAssets` was calculated via `exchangeRateAtTimeOfRequest`, causing withdrawals to fail if share price decreased.

**Resolution:** Refactored minimum asset check logic to use current exchange rate.

#### 2. Users' shares may be locked forever (High)
**Issue:** Malicious users could deposit tiny amounts to victims to extend their share lock period indefinitely.

**Resolution:** Only operators can deposit on behalf of users.

#### 3. Users may lose their expected rewards (High)
**Issue:** 18 decimal precision was insufficient for reward calculations in some cases, causing rounding to 0.

**Resolution:** Increased precision to 1e27 to prevent rounding issues.

#### 4. Missing claim rewards in delayed withdraw (Medium)
**Issue:** DelayedWithdraw contract earned rewards during delay period but had no interface to claim them.

**Resolution:** Added interface to claim rewards and return to protocol.

#### 5. Compound rewards will extend the lock time (Medium)
**Issue:** Compound operation extended account lock period, allowing malicious users to grief others.

**Resolution:** Use bulk deposit for compound operations.

#### 6. Platform fees may be rounded down to 0 (Medium)
**Issue:** Frequent deposits/withdrawals could cause platform fees to round down to 0.

**Resolution:** Only update timestamp when fees are non-zero.

#### 7. Later depositors advantage (Medium)
**Issue:** Later depositors in reward period have advantage over earlier depositors.

**Resolution:** Acknowledged as acceptable trade-off for simplicity.

#### 8. Centralization risk (Medium)
**Issue:** Privileged roles (MANAGER_ROLE, OPERATOR_ROLE) have significant power.

**Resolution:** Implemented multi-layer protection:
- OWNER_ROLE controlled by PrimeTimelock (48h delay)
- PrimeTimelock controlled by 3-of-5 multi-sig
- Fee changes capped at 20% maximum

#### 9. Missing validation for buffer helper (Low)
**Issue:** `disallowBufferHelper` didn't check if the buffer was currently in use.

**Resolution:** Added validation check.

---

## Shieldify Audit (December 2025)

### Project Summary

- **Name:** Prime Vaults
- **Platform:** EVM-compatible chains (Berachain focus)
- **Language:** Solidity
- **Audit Date:** December 2025

### Scope

The Shieldify audit covered:
- Core vault contracts (BoringVault, Teller, Accountant)
- Reward distribution (Distributor)
- Delayed withdrawal mechanism
- Access control (PrimeRBAC, PrimeAuth)
- Cross-chain executor contracts

### Key Findings

All critical and high-severity findings from the Shieldify audit have been addressed. Please refer to the [full report](https://github.com/shieldify-security/audits-portfolio/blob/main/reports/Prime-Vaults-Security-Review.pdf) for details.

---

## Files in Scope

The following files were audited:

| File | Description |
|------|-------------|
| `BoringVault.sol` | Core ERC20 vault contract |
| `Teller.sol` | Deposit/withdrawal gateway |
| `TellerWithBuffer.sol` | Teller with yield layer integration |
| `AccountantProviders.sol` | Exchange rate and fee management |
| `Distributor.sol` | Multi-token reward distribution |
| `DelayedWithdraw.sol` | Time-locked withdrawal security |
| `ManagerWithMerkleVerification.sol` | Strategy execution with Merkle proofs |
| `PrimeAuth.sol` | Contract-level authentication |
| `PrimeRBAC.sol` | Role-based access control |
| `RolesAuthority.sol` | Solmate roles implementation |

---

## Security Improvements Post-Audit

Based on audit findings, the following improvements were implemented:

1. **Enhanced Precision**
   - Reward calculations use 1e27 precision
   - Prevents rounding issues with low-decimal tokens

2. **Lock Period Protection**
   - Only operators can deposit on behalf of users
   - Prevents lock period griefing attacks

3. **Decentralized Governance**
   - Multi-sig wallet (3-of-5) for critical operations
   - 48-hour timelock on all admin actions
   - Fee changes capped at 20%

4. **Buffer Helper Validation**
   - Added checks before disallowing buffer helpers
   - Prevents system from using disallowed buffers

5. **Withdrawal Flow**
   - Refactored exchange rate handling in delayed withdrawals
   - Added reward claiming for pending withdrawal shares

---

## Ongoing Security

### Bug Bounty Program

Prime Vaults maintains an ongoing bug bounty program. Contact security@primevaults.finance for responsible disclosure.

### Monitoring

- Real-time monitoring of all contract interactions
- Automated alerts for unusual activity
- Regular security reviews

---

## Contact

For security-related inquiries:
- Email: security@primevaults.finance
- Telegram: @PrimeVaultsSecurity

---

**Prime Vaults Team**
© 2025 PrimeVaults
