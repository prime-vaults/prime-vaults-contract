# Copilot Instructions for PrimeVaults Smart Contracts

## Project Overview

- **PrimeVaults** is a modular DeFi vault system built on the BoringVault architecture, focused on secure, single-asset
  yield strategies.
- Core contracts are in `contracts/core/`, with supporting modules in `auth/`, `helper/`, `interfaces/`, `strategy/`,
  and `decodersAndSanitizers/`.
- Deployment is managed via Hardhat Ignition modules in `ignition/modules/`.

## Architecture & Data Flow

- **Deposit/Withdraw:** Users interact with Teller contracts (`TellerWithYieldStreaming`, etc.), which route funds to
  vaults and manage yield accrual.
- **Accountant:** Handles exchange rates, platform/performance fees, and yield streaming.
- **Manager:** Executes strategies, optionally with Merkle verification for secure permissioning.
- **Registry:** Tracks all vault deployments and role-based access control (RBAC).
- **DelayedWithdraw:** Implements time-locked withdrawals for added security.
- **Strategy Layer:** Modular, upgradeable strategies managed via the Manager contract.

## Developer Workflows

- **Install:** `pnpm install` (Node.js >= 18.16.0 required)
- **Compile:** `pnpm compile`
- **Test:** `pnpm test` (unit/integration), `pnpm test-local` (local Hardhat node)
- **Deploy:**
  - Start node: `pnpm hardhat node`
  - Deploy modules: `pnpm run deploy --network localhost -f <step>`
  - Full system: `pnpm hardhat run scripts/deploy/full.ts --network <network>`
- **Contract Size:** `pnpm contract-size` (checks 24 KB limit)
- **Lint:** `pnpm lint:sol` (Solidity), `pnpm lint:ts` (TypeScript)
- **Clean:** `pnpm clean`

## Conventions & Patterns

- **Test Conventions:**
  - Scenario documentation at top of each test file
  - Steps numbered as `Step N: Action description` (use decimals for intermediate steps)
  - Time markers (T0, T1, T2) for time-based logic
  - Use `assertApproxEqual` for division/time-based calculations
  - Always provide assertion messages
  - See `test/TEST_CONVENTIONS.md` for full details
- **Deployment Modules:**
  - Module names end with `Module` (e.g., `VaultModule`)
  - Parameters loaded from `ignition/parameters/*.json` (`$global`, `VaultModule`, etc.)
  - All modules re-exported in `ignition/modules/index.ts`
- **RBAC:**
  - Role management via `RolesAuthority.sol` and registry contracts
  - Manager contract uses Merkle verification for permissioned actions
- **External Docs:**
  - See [Veda Documentation](https://docs.veda.tech/) and
    [BoringVault Architecture](https://docs.veda.tech/architecture-and-flow-of-funds)

## AI Assistant Guidelines

- **Context7 Integration:** Always use Context7 MCP tools (`resolve-library-id` → `get-library-docs`) when you need:
  - Code generation or implementation examples
  - Setup or configuration steps for libraries/frameworks
  - Library/API documentation and best practices
  - Do this automatically without waiting for explicit requests
  - Example workflow: For Hardhat tasks → resolve `/nomicfoundation/hardhat` → get docs for specific topics

## Key Files & Directories

- `contracts/core/` — Main vault, teller, accountant, manager contracts
- `ignition/modules/` — Hardhat Ignition deployment scripts
- `test/` — Integration and scenario-based tests
- `scripts/deploy/` — Stepwise deployment scripts
- `test/TEST_CONVENTIONS.md` — Detailed test conventions
- `README.md` — Architecture, workflow, and contract structure

---

For unclear or missing conventions, consult `README.md`, `test/TEST_CONVENTIONS.md`, or ask for clarification.

read -s "CLOUDFLARE_API_TOKEN?CRgWXfvRTsY_LavxwGfEvqSlhV_JddsGJ9xQ4oZj" && export CLOUDFLARE_API_TOKEN && node
/tmp/delete_cf_deployments.js
