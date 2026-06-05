# ledger-core

A production-grade **double-entry accounting ledger** built as a pnpm monorepo. Every financial transaction is recorded as a pair of debits and credits that must balance — a 500-year-old invariant enforced at both the application and database layers.

---

## 1. The Problem — Why Naïve Ledgers Fail

Most applications store money as a single mutable balance column:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = $1;
UPDATE accounts SET balance = balance + 100 WHERE id = $2;
```

This breaks in predictable ways:

| Failure Mode | What Happens |
|---|---|
| **Lost update** | Two concurrent transfers read the same balance, both write back — one disappears |
| **No audit trail** | You can see the current balance, not how it got there |
| **Correction = mutation** | Fixing an error means editing history, which destroys the audit log |
| **Float arithmetic** | `0.1 + 0.2 !== 0.3` — financial calculations done in floats drift over time |
| **Cross-currency confusion** | No mechanism to prevent posting a USD amount to a BRL account |
| **Undetectable corruption** | If a bug posts a one-sided entry, there is no way to detect it later |

Double-entry accounting eliminates all of these by construction.

---

## 2. The Solution

### Double-Entry Invariant

Every journal contains at least two entries. For each currency, debits must equal credits — exactly, in integer arithmetic, verified before any database write and enforced again at commit by a deferred PostgreSQL trigger.

```
∀ journal J, ∀ currency C:
  Σ amount WHERE direction = DEBIT  AND currency = C
= Σ amount WHERE direction = CREDIT AND currency = C
```

Violation → `422 INVARIANT_VIOLATION`. There is no code path that bypasses this check.

### Eight Invariants

| Code | Rule |
|---|---|
| **INV-01** | Debits = credits per currency per journal |
| **INV-02** | Entries are immutable — no UPDATE or DELETE ever |
| **INV-03** | Posted journals are immutable — corrections via reversal only |
| **INV-04** | All amounts stored as positive BIGINT in minor units (no floats) |
| **INV-05** | Entry currency must match account currency |
| **INV-06** | A journal may only be reversed once |
| **INV-07** | A journal requires at least two entries |
| **INV-08** | Entries may only be posted to active accounts |

### Transactional Outbox

Every journal post emits a `journal.posted` event — written to an `outbox` table inside the same database transaction as the entries. A BullMQ worker polls the outbox every 500 ms and publishes to RabbitMQ exchange `ledger.events`. Events are never lost: if the publish fails, the row stays `PENDING` and retries up to 3 times before moving to `FAILED`.

### Balance Derivation

Balances are never stored. They are always computed from entries:

```sql
SELECT COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END), 0)
FROM entries WHERE account_id = $1 AND currency = $2;
```

This means point-in-time queries (`balance/as-of`) are trivially correct — add `AND created_at <= $3`.

---

## 3. Architecture

```mermaid
graph TB
    subgraph Client
        CURL[curl / dashboard]
    end

    subgraph "apps/api — NestJS + Fastify"
        CTRL[Controllers]
        SVC[Services]
        REPO[Repositories]
        RELAY[OutboxRelay\nBullMQ Worker]
        RECON[ReconciliationJob\nBullMQ Cron]
    end

    subgraph Persistence
        PG[(PostgreSQL 16\naccounts · journals · entries\noutbox · reconciliation_runs\nfx_rates)]
        TRIGGER[Deferred Trigger\ntrg_double_entry_balance]
    end

    subgraph Messaging
        REDIS[(Redis 7\nBullMQ queues)]
        RMQ[RabbitMQ 3.13\nexchange: ledger.events]
    end

    subgraph "apps/dashboard — Next.js 16"
        DASH[React Query\nshadcn/ui · Recharts]
    end

    CURL -->|HTTP| CTRL
    DASH -->|HTTP via rewrite| CTRL
    CTRL --> SVC --> REPO
    REPO -->|$transaction| PG
    PG --- TRIGGER
    REPO -->|outbox.write\n same tx| PG
    RELAY -->|poll PENDING| PG
    RELAY -->|publish envelope| RMQ
    RELAY <-->|repeat every 500ms| REDIS
    RECON <-->|cron 00:00 UTC| REDIS
    RECON -->|run + outbox| PG
```

### Request Flow — POST /journals

```mermaid
sequenceDiagram
    participant C as Client
    participant S as JournalsService
    participant R as JournalsRepository
    participant DB as PostgreSQL
    participant W as OutboxRelay
    participant MQ as RabbitMQ

    C->>S: POST /journals { entries }
    S->>S: INV-07: entries.length >= 2
    S->>S: INV-04: all amounts > 0
    S->>S: idempotency check (reference)
    S->>DB: findByIds(accountIds)
    S->>S: INV-08: all accounts active
    S->>S: INV-01: Σ debits = Σ credits per currency
    S->>S: INV-05: entry.currency = account.currency
    S->>R: create(data)
    R->>DB: BEGIN
    R->>DB: INSERT journals
    R->>DB: INSERT entries (N rows)
    R->>DB: INSERT outbox (journal.posted envelope)
    DB->>DB: DEFERRED TRIGGER checks INV-01
    R->>DB: COMMIT
    R-->>C: 201 { journal + entries }
    W->>DB: SELECT PENDING LIMIT 10
    W->>MQ: publish(ledger.events, journal.posted, envelope)
    W->>DB: UPDATE outbox status=SENT
```

### Module Map

```
apps/
  api/                     NestJS 11 + Fastify
    src/
      accounts/            CRUD + balance queries
      journals/            posting + reversal + invariant checks
      outbox/              transactional write + BullMQ relay
      reconciliation/      ledger-wide balance check + cron
      fx-rates/            exchange rate upsert + lookup
      metrics/             Prometheus counters (global module)
      health/              liveness check
      shared/
        domain/            ULID generator
        errors/            typed LedgerError with HTTP codes
        events/            EventEnvelope type
  dashboard/               Next.js 16 + React Query + shadcn/ui
adr/                       Architecture Decision Records
```

---

## 4. Running Locally

**Prerequisites:** Docker, Node.js 20+, pnpm 9+

### Start infrastructure

```bash
docker compose up -d
# PostgreSQL :5433  Redis :6380  RabbitMQ :5672 (mgmt :15672)
```

### Install dependencies

```bash
pnpm install
```

### Configure environment

```bash
cp apps/api/.env.example apps/api/.env   # already committed with dev defaults
```

Default values (all point to Docker services above):

```
DATABASE_URL=postgresql://ledger:ledger_secret@localhost:5433/ledger_core
REDIS_HOST=localhost
REDIS_PORT=6380
RABBITMQ_URL=amqp://ledger:ledger_secret@localhost:5672
PORT=3001
RECONCILIATION_CRON="0 0 * * *"
```

### Migrate and seed

```bash
cd apps/api

# Run migrations (creates tables, indexes, deferred trigger)
pnpm exec prisma migrate deploy

# Seed demo data (12 accounts, 10 journals, 3 FX rates)
ts-node --project tsconfig.seed.json prisma/seed.ts
```

Seed output:

```
[ok] 12 accounts upserted
[ok] 10 journals inserted
[ok] 22 entries inserted
[ok] J4 marked REVERSED, J10 linked as reversal
[ok] 3 FX rates upserted

=== Seed Report ===
  Accounts:         12
  Journals:         10
  USD balanced:     PASS
  BRL balanced:     PASS
  Reconciliation:   PASS
```

### Start API

```bash
cd apps/api
pnpm start:dev          # http://localhost:3001/api/v1
```

### Start dashboard

```bash
cd apps/dashboard
pnpm dev                # http://localhost:3000
```

---

## 5. Key Endpoints

### Accounts

```bash
# Create account
curl -s -X POST http://localhost:3001/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Cash","type":"ASSET","currency":"USD"}'

# List with balances
curl -s "http://localhost:3001/api/v1/accounts?limit=5"

# Point-in-time balance
curl -s "http://localhost:3001/api/v1/accounts/01ACCT.../balance/as-of?timestamp=2026-01-15T00:00:00Z"

# Balance time-series (monthly)
curl -s "http://localhost:3001/api/v1/accounts/01ACCT.../balance/history?from=2026-01-01&to=2026-06-30&granularity=monthly"
```

### Journals

```bash
# Post a balanced journal
curl -s -X POST http://localhost:3001/api/v1/journals \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Customer payment",
    "reference": "PAY-2026-001",
    "entries": [
      {"account_id": "01ACCT...cash",   "direction": "DEBIT",  "amount": 50000, "currency": "USD"},
      {"account_id": "01ACCT...revenue","direction": "CREDIT", "amount": 50000, "currency": "USD"}
    ]
  }'
# → 201. Re-POST same reference → 200 (idempotent).

# Unbalanced journal (INV-01 violation)
curl -s -X POST http://localhost:3001/api/v1/journals \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"account_id":"01ACCT...","direction":"DEBIT","amount":100,"currency":"USD"}]}'
# → 422 {"error":"INVALID_JOURNAL","message":"Journal must have at least 2 entries"}

# Reverse a journal
curl -s -X POST http://localhost:3001/api/v1/journals/01JRNL.../reverse \
  -H "Content-Type: application/json" \
  -d '{"description":"Correction"}'
# → 201 reversal journal with all entries flipped
```

### Reconciliation

```bash
# Trigger manual run
curl -s -X POST http://localhost:3001/api/v1/reconciliation/run
# → 200 {"status":"PASS","total_debits":127748850,"total_credits":127748850,"discrepancy":0}

# Run history
curl -s http://localhost:3001/api/v1/reconciliation/runs

# Specific run
curl -s http://localhost:3001/api/v1/reconciliation/runs/01RUN...
```

### FX Rates

```bash
# Upsert rate
curl -s -X POST http://localhost:3001/api/v1/fx-rates \
  -H "Content-Type: application/json" \
  -d '{"base_currency":"USD","quote_currency":"BRL","rate":5.12,"effective_date":"2026-06-04"}'

# Latest rate for pair
curl -s "http://localhost:3001/api/v1/fx-rates/latest?base=USD&quote=BRL"
```

### System

```bash
# Health check (probes DB + outbox lag)
curl -s http://localhost:3001/api/v1/health
# → {"status":"ok","checks":{"database":{"status":"ok","latency_ms":2},"outbox_lag":{"status":"ok","pending_events":0},...}}

# Prometheus metrics
curl -s http://localhost:3001/api/v1/metrics | grep ledger_
# ledger_journals_posted_total 14
# ledger_accounts_created_total 3
# ledger_reconciliation_runs_total{status="PASS"} 2
```

### Error envelope (all errors)

```json
{
  "error": "INVARIANT_VIOLATION",
  "message": "Debits do not equal credits for currency USD",
  "detail": { "currency": "USD" }
}
```

---

## 6. Stack and Design Decisions

### Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 20 + TypeScript 5 | Type safety across the full stack |
| API framework | NestJS 11 + Fastify | Structured DI; Fastify over Express for throughput |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Type-safe queries; native pg driver for BigInt |
| Database | PostgreSQL 16 | Deferred triggers, partial indexes, JSONB |
| Job queue | BullMQ 5 + Redis 7 | Repeatable jobs for outbox relay and reconciliation cron |
| Message broker | RabbitMQ 3.13 | Topic exchange for fan-out to downstream consumers |
| Dashboard | Next.js 16 + React Query 5 | App Router; server-side rewrite proxies API calls |
| UI components | shadcn/ui (radix-nova) + Recharts 3 | Accessible primitives; composable charts |
| ID generation | ULID (monotonic) | Sortable by creation time; cursor pagination without extra index |
| Metrics | prom-client + @willsoto/nestjs-prometheus | Standard Prometheus exposition format |

### Architecture Decision Records

| ADR | Decision |
|---|---|
| [ADR-001](adr/ADR-001-double-entry-invariant-enforcement.md) | Enforce INV-01 at both application layer (service) and DB layer (deferred trigger) — defense in depth |
| [ADR-002](adr/ADR-002-ulid-vs-uuid.md) | ULID over UUID — monotonic sort order enables cursor pagination on `id` column without a separate `created_at` index |
| [ADR-003](adr/ADR-003-bigint-money-representation.md) | BIGINT minor units over NUMERIC/Decimal — no floating-point drift; arithmetic is exact integer math |
| [ADR-004](adr/ADR-004-outbox-pattern-for-events.md) | Transactional outbox over direct publish — event and entries commit atomically; no phantom events on rollback |
| [ADR-005](adr/ADR-005-per-currency-invariant-check.md) | Invariant checked per currency, not across all currencies — enables multi-currency journals without spurious violations |

### Key design choices not in ADRs

**Balance is never stored.** It is always derived from entries. This eliminates an entire class of consistency bugs where the stored balance disagrees with the entry history. The cost is a `SUM()` on every balance read — acceptable because the query hits the `(account_id, created_at DESC)` index and most accounts have manageable entry counts.

**Idempotency via `reference` field.** Clients provide an external idempotency key. If the key already exists, the existing journal is returned with HTTP 200. This means payment processors can safely retry without double-posting.

**Cursor pagination on `id` (ULID).** Accounts list uses `id > cursor` (ASC), journals and entries use `id < cursor` (DESC). Because ULIDs are monotonically sortable, this is equivalent to time-ordered pagination without a secondary sort column.

**Outbox event envelope.** Every event stored in the outbox includes `event_id`, `version: "1.0"`, and `occurred_at` alongside the domain payload. Consumers can deduplicate on `event_id` and detect schema version changes on `version`.

---

## License

MIT
