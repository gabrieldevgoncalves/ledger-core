# ledger-core

A double-entry ledger engine built for financial systems — payments platforms, digital banks, and fintech infrastructure.

---

## The problem

Most financial applications store balances as a single mutable number. It works fine until it doesn't: a race condition overwrites a concurrent write, a bug credits an account without debiting any source, a customer disputes a charge and there's no immutable record of what happened.

The failure modes are predictable, but they keep showing up because the fix requires rethinking the data model from scratch — not patching a column.

Double-entry bookkeeping solves this. Every movement of value is recorded as two entries across two accounts: one debit, one credit. The constraint is mathematical:

```
For every transaction: Σ debits = Σ credits
```

Money cannot be created or destroyed — it can only move. This makes the ledger auditable by construction, consistent by invariant, and reconstructable at any point in time.

`ledger-core` is an implementation of that model as a production-ready API service.

---

## What it does

- **Posts journals atomically.** A journal is a group of balanced entries. If the double-entry constraint is violated, nothing is written — no partial state, no rollback needed.
- **Enforces the invariant at two layers.** Application layer rejects unbalanced journals before touching the database. A deferred database trigger catches anything that slips through.
- **Stores amounts as integers.** All monetary values are stored as `BIGINT` in minor units (cents, pence, centavos). No floating-point arithmetic, no rounding errors.
- **Derives balances from entries.** Account balances are never stored as mutable columns. They are computed from the entry log, which means any past balance is reconstructable from any past timestamp.
- **Supports reversals, not corrections.** A posted journal cannot be modified. To correct a mistake, a reversal journal is created — mirroring the original entries with directions flipped. The audit trail is complete.
- **Publishes domain events reliably.** Events (`journal.posted`, `journal.reversed`, `reconciliation.completed`) are written to an outbox table within the same database transaction as the journal, then relayed to RabbitMQ asynchronously. No event is lost if the process crashes between the write and the publish.
- **Runs reconciliation on a schedule.** A daily job verifies that the sum of all debits equals the sum of all credits across the entire ledger. Discrepancies emit an alert event and are stored in a run history table.

---

## Why this matters to a financial company

Ledger correctness is cheap to get right at the beginning and expensive to fix after the fact. The common failure pattern: a startup builds a mutable balance system, ships fast, raises a Series B, and discovers during due diligence that their balances cannot be reconciled from first principles. The fix is a data migration measured in engineering-months, not days.

A ledger built on double-entry with immutable entries, database-level constraints, and an outbox-based event model is not overengineering — it is the baseline for any system that moves real money.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    ledger-core                       │
│                                                      │
│  Next.js Dashboard          NestJS API               │
│  (port 3000)      ────────► (port 3001)              │
│                                                      │
│                    ┌────────────────────────────┐    │
│                    │  AccountsModule            │    │
│                    │  JournalsModule            │    │
│                    │    └─ InvariantCheck       │    │
│                    │  ReconciliationModule      │    │
│                    │  OutboxModule (relay)      │    │
│                    └────────────┬───────────────┘    │
│                                 │                    │
│          ┌──────────────────────▼──────────────┐     │
│          │  PostgreSQL 16                       │     │
│          │  accounts / journals / entries       │     │
│          │  fx_rates / outbox / recon_runs      │     │
│          └─────────────────────────────────────┘     │
│                                                      │
│          ┌──────────────────────────────────────┐    │
│          │  RabbitMQ 3.13                        │    │
│          │  exchange: ledger.events              │    │
│          └──────────────────────────────────────┘    │
│                                                      │
│          ┌──────────────────────────────────────┐    │
│          │  Redis 7  (BullMQ queues)             │    │
│          └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| API framework | NestJS + TypeScript (strict) |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Queue | BullMQ + Redis |
| Messaging | RabbitMQ |
| Dashboard | Next.js 15 + shadcn/ui + Recharts |
| Package manager | pnpm (monorepo workspaces) |
| Containers | Docker + Docker Compose |

---

## Running locally

**Prerequisites:** Docker Desktop, Node.js 22+, pnpm.

```bash
# Clone and install
git clone https://github.com/gabrieldevgoncalves/ledger-core
cd ledger-core
pnpm install

# Start PostgreSQL, Redis, and RabbitMQ
pnpm infra:up

# Run database migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start API (port 3001) and dashboard (port 3000)
pnpm dev
```

Services:

| Service | URL |
|---|---|
| API | http://localhost:3001 |
| Dashboard | http://localhost:3000 |
| API docs (Swagger) | http://localhost:3001/api/docs |
| RabbitMQ management | http://localhost:15672 |
| Prisma Studio | `pnpm db:studio` |

---

## Key endpoints

**Post a journal**
```bash
curl -X POST http://localhost:3001/api/v1/journals \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Customer deposit",
    "reference": "wire-00182736",
    "entries": [
      { "account_id": "ACCOUNT_CASH_ID", "direction": "DEBIT",  "amount": 100000, "currency": "USD" },
      { "account_id": "ACCOUNT_LIAB_ID", "direction": "CREDIT", "amount": 100000, "currency": "USD" }
    ]
  }'
```

**Invariant violation — rejected before any write**
```bash
# Debits 100000, credits 90000 — returns 422
curl -X POST http://localhost:3001/api/v1/journals \
  -d '{
    "entries": [
      { "account_id": "...", "direction": "DEBIT",  "amount": 100000, "currency": "USD" },
      { "account_id": "...", "direction": "CREDIT", "amount": 90000,  "currency": "USD" }
    ]
  }'

# Response
{ "error": "INVARIANT_VIOLATION", "detail": { "total_debits": 100000, "total_credits": 90000, "discrepancy": 10000 } }
```

**Point-in-time balance**
```bash
curl "http://localhost:3001/api/v1/accounts/ACCOUNT_ID/balance/as-of?timestamp=2026-01-15T00:00:00Z"
```

**Trigger reconciliation**
```bash
curl -X POST http://localhost:3001/api/v1/reconciliation/run
# { "status": "PASS", "total_debits": 1000000, "total_credits": 1000000, "discrepancy": 0 }
```

---

## Domain invariants

These constraints hold at all times and are enforced at both the application and database layers:

| ID | Rule |
|---|---|
| INV-01 | For every journal: `Σ debits = Σ credits` per currency |
| INV-02 | Entries are immutable — no UPDATE or DELETE after insert |
| INV-03 | Journals are immutable — corrections via reversal only |
| INV-04 | All amounts are positive integers in minor units |
| INV-05 | Entry currency must match the account's currency |
| INV-06 | A journal may only be reversed once |
| INV-07 | A journal requires at least two entries |
| INV-08 | Entries may only be posted to active accounts |

---

## Architecture decisions

Design decisions with explicit trade-off analysis are documented in the `adr/` folder:

- [ADR-001](adr/ADR-001-double-entry-invariant-enforcement.md) — Enforcing the invariant at app layer + DB trigger
- [ADR-002](adr/ADR-002-ulid-vs-uuid.md) — ULID over UUIDv4 for time-ordered IDs
- [ADR-003](adr/ADR-003-bigint-money-representation.md) — `bigint` in minor units over `Decimal.js` or `number`
- [ADR-004](adr/ADR-004-outbox-pattern-for-events.md) — Transactional Outbox over direct RabbitMQ publish
- [ADR-005](adr/ADR-005-per-currency-invariant-check.md) — Per-currency balance check for multi-currency journals

---

## Project context

This is one of a series of open-source financial infrastructure projects built to demonstrate production-grade backend architecture in TypeScript/NestJS, with a focus on the primitives that fintech and payments companies deal with daily:

- `ledger-core` — double-entry ledger engine (this repo)
- [`idempotency-vault`](https://github.com/gabrieldevgoncalves/idempotency-vault) — idempotent payments API middleware
- [`webhook-engine`](https://github.com/gabrieldevgoncalves/webhook-engine) — reliable webhook delivery with retry and dead-letter

---

## License

MIT
