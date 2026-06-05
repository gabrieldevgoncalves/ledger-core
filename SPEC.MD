# SPEC.md — ledger-core
> Technical specification. Authored before any implementation. This document is the source of truth for all domain rules, data contracts, and behavioral expectations.

---

## 1. Domain Rules (Invariants)

These rules are never violated. If any rule cannot be satisfied, the operation is rejected atomically.

### INV-01 — Double-Entry Balance
For every posted Journal, the sum of DEBIT amounts must equal the sum of CREDIT amounts, evaluated per currency.

```
∀ journal J, ∀ currency C:
  Σ entry.amount WHERE entry.direction = 'DEBIT'  AND entry.currency = C
= Σ entry.amount WHERE entry.direction = 'CREDIT' AND entry.currency = C
```

Enforced at: application layer (JournalService) + database layer (deferred trigger).

### INV-02 — Entry Immutability
Entries are never updated or deleted after insertion. No UPDATE or DELETE on the `entries` table is permitted from application code.

### INV-03 — Journal Immutability
Posted journals are never modified. Corrections are made via reversal journals only.

### INV-04 — Monetary Amounts
All amounts are stored as positive BIGINT in minor units (cents for USD, pence for GBP, centavos for BRL). Zero and negative amounts are rejected.

### INV-05 — Account Currency Lock
An entry's currency must match the currency of the account it is posted to. Cross-currency entries are rejected with `CURRENCY_MISMATCH`.

### INV-06 — Single Reversal
A journal may only be reversed once. Attempting to reverse an already-reversed journal returns `ALREADY_REVERSED`.

### INV-07 — Minimum Entries
A journal must contain at least two entries. Single-entry journals are rejected with `INVALID_JOURNAL`.

### INV-08 — Active Accounts Only
Entries may only be posted to active accounts. Posting to a deactivated account returns `ACCOUNT_INACTIVE`.

---

## 2. Data Model

### 2.1 accounts

| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PK, ULID |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL, CHECK IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') |
| currency | CHAR(3) | NOT NULL, ISO 4217 |
| description | TEXT | nullable |
| metadata | JSONB | NOT NULL DEFAULT '{}' |
| is_active | BOOLEAN | NOT NULL DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### 2.2 journals

| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PK, ULID |
| description | TEXT | nullable |
| reference | TEXT | UNIQUE, nullable — external idempotency key |
| metadata | JSONB | NOT NULL DEFAULT '{}' |
| fx_rate | NUMERIC(18,8) | nullable |
| fx_base_currency | CHAR(3) | nullable |
| fx_quote_currency | CHAR(3) | nullable |
| reverses_journal_id | TEXT | FK journals(id), nullable |
| reversed_by_id | TEXT | FK journals(id), nullable |
| status | TEXT | NOT NULL DEFAULT 'POSTED', CHECK IN ('POSTED','REVERSED') |
| posted_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### 2.3 entries

| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PK, ULID |
| journal_id | TEXT | NOT NULL, FK journals(id) |
| account_id | TEXT | NOT NULL, FK accounts(id) |
| direction | TEXT | NOT NULL, CHECK IN ('DEBIT','CREDIT') |
| amount | BIGINT | NOT NULL, CHECK > 0 |
| currency | CHAR(3) | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**No UPDATE or DELETE permitted on this table.**

### 2.4 fx_rates

| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PK, ULID |
| base_currency | CHAR(3) | NOT NULL |
| quote_currency | CHAR(3) | NOT NULL |
| rate | NUMERIC(18,8) | NOT NULL, CHECK > 0 |
| effective_date | DATE | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| — | UNIQUE | (base_currency, quote_currency, effective_date) |

### 2.5 reconciliation_runs

| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PK, ULID |
| status | TEXT | NOT NULL, CHECK IN ('PASS','FAIL') |
| total_debits | BIGINT | NOT NULL |
| total_credits | BIGINT | NOT NULL |
| discrepancy | BIGINT | NOT NULL DEFAULT 0 |
| affected_accounts | TEXT[] | nullable |
| run_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| duration_ms | INTEGER | NOT NULL |

### 2.6 outbox

| Column | Type | Constraints |
|---|---|---|
| id | TEXT | PK, ULID |
| event_type | TEXT | NOT NULL |
| payload | JSONB | NOT NULL |
| status | TEXT | NOT NULL DEFAULT 'PENDING', CHECK IN ('PENDING','SENT','FAILED') |
| attempts | INTEGER | NOT NULL DEFAULT 0 |
| last_error | TEXT | nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| sent_at | TIMESTAMPTZ | nullable |

---

## 3. Indexes

```sql
-- entries: time-ordered lookup per account (most common query)
CREATE INDEX idx_entries_account_created ON entries(account_id, created_at DESC);

-- entries: all entries for a journal
CREATE INDEX idx_entries_journal ON entries(journal_id);

-- journals: idempotency lookup
CREATE UNIQUE INDEX idx_journals_reference ON journals(reference) WHERE reference IS NOT NULL;

-- journals: date-range queries
CREATE INDEX idx_journals_posted_at ON journals(posted_at DESC);

-- outbox: relay worker polling
CREATE INDEX idx_outbox_pending ON outbox(created_at ASC) WHERE status = 'PENDING';
```

---

## 4. Balance Derivation

Balance is always derived from entries. It is never stored as a mutable column.

```sql
-- Current balance for an account
SELECT
  SUM(CASE WHEN direction = 'DEBIT'  THEN  amount
           WHEN direction = 'CREDIT' THEN -amount
      END) AS balance_minor_units
FROM entries
WHERE account_id = $1
  AND currency   = $2;

-- Point-in-time balance
SELECT
  SUM(CASE WHEN direction = 'DEBIT'  THEN  amount
           WHEN direction = 'CREDIT' THEN -amount
      END) AS balance_minor_units
FROM entries
WHERE account_id  = $1
  AND currency    = $2
  AND created_at <= $3;  -- as_of timestamp
```

**Sign convention:** ASSET and EXPENSE accounts have a natural DEBIT balance (positive = healthy). LIABILITY, EQUITY, and REVENUE accounts have a natural CREDIT balance (negative in this formula = healthy). Consumers interpret sign based on account type.

---

## 5. API Specification

### 5.1 Accounts

#### POST /api/v1/accounts
Create an account.

**Request body:**
```json
{
  "name": "string, required",
  "type": "ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE",
  "currency": "string, ISO 4217, required",
  "description": "string, optional",
  "metadata": "object, optional"
}
```

**Response 201:**
```json
{
  "id": "ULID",
  "name": "string",
  "type": "string",
  "currency": "string",
  "description": "string | null",
  "metadata": "object",
  "is_active": true,
  "created_at": "ISO 8601"
}
```

**Errors:** `400` validation failure.

---

#### GET /api/v1/accounts
List accounts.

**Query params:**
- `type` — filter by account type
- `currency` — filter by ISO 4217 code
- `cursor` — pagination cursor (last seen ID)
- `limit` — default 20, max 100

**Response 200:**
```json
{
  "data": [{ "id": "...", "name": "...", "type": "...", "currency": "...", "balance_minor_units": 0, "is_active": true }],
  "next_cursor": "ULID | null"
}
```

---

#### GET /api/v1/accounts/:id
Get account with current derived balance.

**Response 200:**
```json
{
  "id": "ULID",
  "name": "string",
  "type": "string",
  "currency": "string",
  "balance_minor_units": 100000,
  "is_active": true,
  "created_at": "ISO 8601"
}
```

**Errors:** `404 ACCOUNT_NOT_FOUND`.

---

#### PATCH /api/v1/accounts/:id/deactivate
Deactivate an account. Idempotent — deactivating an already-inactive account returns 200.

**Response 200:**
```json
{ "id": "ULID", "is_active": false }
```

---

#### GET /api/v1/accounts/:id/entries
List entries for an account.

**Query params:**
- `from` — ISO 8601 start date, optional
- `to` — ISO 8601 end date, optional
- `cursor` — pagination cursor
- `limit` — default 50, max 200

**Response 200:**
```json
{
  "data": [
    {
      "id": "ULID",
      "journal_id": "ULID",
      "direction": "DEBIT | CREDIT",
      "amount": 100000,
      "currency": "USD",
      "created_at": "ISO 8601"
    }
  ],
  "next_cursor": "ULID | null"
}
```

---

#### GET /api/v1/accounts/:id/balance
Current derived balance.

**Response 200:**
```json
{
  "account_id": "ULID",
  "currency": "USD",
  "balance_minor_units": 100000,
  "computed_at": "ISO 8601"
}
```

---

#### GET /api/v1/accounts/:id/balance/as-of
Point-in-time balance.

**Query params:**
- `timestamp` — ISO 8601, required

**Response 200:**
```json
{
  "account_id": "ULID",
  "currency": "USD",
  "balance_minor_units": 80000,
  "as_of": "ISO 8601"
}
```

---

#### GET /api/v1/accounts/:id/balance/history
Time-series balance.

**Query params:**
- `from` — ISO 8601, required
- `to` — ISO 8601, required
- `granularity` — `daily | weekly | monthly`, default `daily`

**Response 200:**
```json
{
  "account_id": "ULID",
  "currency": "USD",
  "granularity": "daily",
  "series": [
    { "date": "2026-05-01", "balance_minor_units": 50000 },
    { "date": "2026-05-02", "balance_minor_units": 150000 }
  ]
}
```

---

### 5.2 Journals

#### POST /api/v1/journals
Post a journal atomically.

**Request body:**
```json
{
  "description": "string, optional",
  "reference": "string, optional — idempotency key",
  "metadata": "object, optional",
  "fx_rate": "number, optional",
  "fx_base_currency": "string, optional",
  "fx_quote_currency": "string, optional",
  "entries": [
    {
      "account_id": "ULID, required",
      "direction": "DEBIT | CREDIT",
      "amount": "integer > 0, minor units",
      "currency": "ISO 4217"
    }
  ]
}
```

**Validation before any DB write:**
1. `entries.length >= 2` — else `INVALID_JOURNAL`
2. All `amount` > 0 — else `INVALID_AMOUNT`
3. All `account_id` exist — else `ACCOUNT_NOT_FOUND`
4. All accounts are active — else `ACCOUNT_INACTIVE`
5. Per-currency: `Σ debits = Σ credits` — else `INVARIANT_VIOLATION`
6. `entry.currency` matches `account.currency` — else `CURRENCY_MISMATCH`

If `reference` is provided and already exists: return existing journal with `200` (idempotent).

**Response 201:**
```json
{
  "id": "ULID",
  "description": "string | null",
  "reference": "string | null",
  "status": "POSTED",
  "fx_rate": "number | null",
  "fx_base_currency": "string | null",
  "fx_quote_currency": "string | null",
  "entries": [
    {
      "id": "ULID",
      "account_id": "ULID",
      "direction": "DEBIT | CREDIT",
      "amount": 100000,
      "currency": "USD"
    }
  ],
  "posted_at": "ISO 8601"
}
```

**Errors:**

| Code | HTTP | Condition |
|---|---|---|
| `INVALID_JOURNAL` | 422 | fewer than 2 entries |
| `INVALID_AMOUNT` | 422 | amount <= 0 |
| `ACCOUNT_NOT_FOUND` | 404 | account_id does not exist |
| `ACCOUNT_INACTIVE` | 422 | account is deactivated |
| `INVARIANT_VIOLATION` | 422 | debits ≠ credits per currency |
| `CURRENCY_MISMATCH` | 422 | entry currency ≠ account currency |

---

#### GET /api/v1/journals
List journals.

**Query params:**
- `from` — ISO 8601
- `to` — ISO 8601
- `account_id` — journals that include this account
- `reference` — exact match
- `cursor`, `limit` (default 20, max 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "ULID",
      "description": "string | null",
      "reference": "string | null",
      "status": "POSTED | REVERSED",
      "entry_count": 2,
      "posted_at": "ISO 8601"
    }
  ],
  "next_cursor": "ULID | null"
}
```

---

#### GET /api/v1/journals/:id
Get journal with all entries.

**Response 200:** full journal object with entries array.

**Errors:** `404 JOURNAL_NOT_FOUND`.

---

#### POST /api/v1/journals/:id/reverse
Reverse a posted journal.

**Request body:** optional `{ "description": "string" }`.

**Behavior:**
1. Load original journal and all its entries.
2. Verify journal is not already reversed — else `409 ALREADY_REVERSED`.
3. Create reversal journal: each original entry becomes a new entry with direction flipped.
4. Set original journal `status = 'REVERSED'`, `reversed_by_id = reversal.id`.
5. Set reversal journal `reverses_journal_id = original.id`.
6. All in a single database transaction.

**Response 201:** reversal journal object.

**Errors:** `404 JOURNAL_NOT_FOUND`, `409 ALREADY_REVERSED`.

---

### 5.3 Reconciliation

#### POST /api/v1/reconciliation/run
Trigger a manual reconciliation run synchronously.

**Response 200:**
```json
{
  "id": "ULID",
  "status": "PASS | FAIL",
  "total_debits": 1000000,
  "total_credits": 1000000,
  "discrepancy": 0,
  "affected_accounts": [],
  "run_at": "ISO 8601",
  "duration_ms": 42
}
```

---

#### GET /api/v1/reconciliation/runs
List past runs, newest first.

**Query params:** `cursor`, `limit` (default 20).

---

#### GET /api/v1/reconciliation/runs/:id
Get a specific run.

---

### 5.4 FX Rates

#### GET /api/v1/fx-rates
List rates. Query params: `base`, `quote`, `date`.

#### POST /api/v1/fx-rates
Upsert a rate.

**Request body:**
```json
{
  "base_currency": "USD",
  "quote_currency": "BRL",
  "rate": 5.12,
  "effective_date": "2026-05-31"
}
```

#### GET /api/v1/fx-rates/latest?base=USD&quote=BRL
Returns the most recent rate for the pair.

---

### 5.5 System

#### GET /api/v1/health

**Response 200:**
```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok", "latency_ms": 3 },
    "rabbitmq": { "status": "ok" },
    "outbox_lag": { "status": "ok", "pending_events": 0 }
  },
  "version": "1.0.0"
}
```

#### GET /api/v1/metrics
Prometheus text format.

---

## 6. Event Schemas

### Envelope (all events)
```typescript
{
  event_id: string        // ULID
  event_type: string
  version: "1.0"
  occurred_at: string     // ISO 8601 UTC
  payload: object
}
```

### journal.posted
```typescript
{
  journal_id: string
  reference: string | null
  entry_count: number
  currencies: string[]
  total_debit_by_currency: Record<string, number>
  posted_at: string
}
```

### journal.reversed
```typescript
{
  reversal_journal_id: string
  original_journal_id: string
  reversed_at: string
}
```

### reconciliation.completed
```typescript
{
  run_id: string
  status: "PASS" | "FAIL"
  total_debits: number
  total_credits: number
  discrepancy: number
  run_at: string
  duration_ms: number
}
```

---

## 7. Outbox Relay Behavior

1. Worker polls `outbox` WHERE `status = 'PENDING'` ORDER BY `created_at ASC` LIMIT 10 every 500ms.
2. For each event: publish to RabbitMQ exchange `ledger.events` with routing key = `event_type`.
3. On success: UPDATE `status = 'SENT'`, `sent_at = now()`.
4. On failure: increment `attempts`, set `last_error`.
5. After 3 failed attempts: UPDATE `status = 'FAILED'`, emit structured log `outbox.relay.dead`.
6. Relay runs in a dedicated BullMQ repeatable job — not in the HTTP request path.

---

## 8. Error Response Schema

All errors follow this envelope:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "detail": {}
}
```

### Error Codes

| Code | HTTP | Description |
|---|---|---|
| `INVALID_JOURNAL` | 422 | Journal structural validation failed |
| `INVALID_AMOUNT` | 422 | Amount is zero or negative |
| `INVARIANT_VIOLATION` | 422 | Double-entry balance not satisfied |
| `CURRENCY_MISMATCH` | 422 | Entry currency ≠ account currency |
| `ACCOUNT_NOT_FOUND` | 404 | Account does not exist |
| `ACCOUNT_INACTIVE` | 422 | Account is deactivated |
| `JOURNAL_NOT_FOUND` | 404 | Journal does not exist |
| `ALREADY_REVERSED` | 409 | Journal already has a reversal |
| `VALIDATION_ERROR` | 400 | Request body failed DTO validation |
| `SERVICE_UNAVAILABLE` | 503 | Database or dependency unavailable |

---

## 9. Module Structure

```
src/
├── accounts/
│   ├── accounts.module.ts
│   ├── accounts.controller.ts
│   ├── accounts.service.ts
│   ├── accounts.repository.ts
│   └── dto/
│       ├── create-account.dto.ts
│       └── list-accounts.dto.ts
├── journals/
│   ├── journals.module.ts
│   ├── journals.controller.ts
│   ├── journals.service.ts
│   ├── journals.repository.ts
│   ├── invariant/
│   │   └── double-entry.invariant.ts
│   └── dto/
│       ├── post-journal.dto.ts
│       └── list-journals.dto.ts
├── reconciliation/
│   ├── reconciliation.module.ts
│   ├── reconciliation.controller.ts
│   ├── reconciliation.service.ts
│   └── reconciliation.job.ts
├── fx-rates/
│   ├── fx-rates.module.ts
│   ├── fx-rates.controller.ts
│   └── fx-rates.service.ts
├── outbox/
│   ├── outbox.module.ts
│   ├── outbox.service.ts
│   └── outbox.relay.ts
├── shared/
│   ├── domain/
│   │   ├── money.value-object.ts
│   │   └── ulid.ts
│   ├── events/
│   │   └── event-envelope.ts
│   └── errors/
│       └── ledger-errors.ts
└── main.ts
```

---

## 10. Implementation Phases

Claude Code executes phases in order. Do not begin a phase until the previous is complete and tests pass.

| Phase | Scope | Done When |
|---|---|---|
| 0 | Prisma schema + migrations + Docker Compose healthy | `docker compose up` + `prisma migrate dev` succeeds |
| 1 | NestJS bootstrap, health endpoint, shared utilities (ULID, Money, errors) | `GET /health` returns 200 |
| 2 | Accounts module (CRUD + deactivate) | All account endpoints working, unit tests pass |
| 3 | Journals module — post + invariant check | INV-01 enforced, integration tests for all error codes |
| 4 | Journals — list, get, reverse | Reversal creates mirror entries, INV-06 enforced |
| 5 | Balance queries (current, as-of, history) | Point-in-time balance returns correct value for seeded data |
| 6 | Outbox + RabbitMQ relay | `journal.posted` event arrives in RabbitMQ after posting |
| 7 | Reconciliation engine + cron job | Manual run returns PASS on balanced ledger, FAIL on corrupted |
| 8 | FX rates | Upsert + latest endpoint working |
| 9 | Prometheus metrics + structured logging | `/metrics` returns ledger counters |
| 10 | Next.js dashboard | Accounts list + journal view + balance chart rendering |