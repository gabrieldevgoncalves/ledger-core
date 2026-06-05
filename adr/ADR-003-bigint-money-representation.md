# ADR-003: Monetary Amount Representation

**Status:** Accepted
**Date:** 2026-05-31
**Deciders:** Gabriel Gonçalves

## Context

All monetary amounts in the system must be stored and computed without floating-point rounding errors. A ledger that loses a cent due to IEEE 754 precision loss is incorrect by definition.

Amounts flow through: HTTP request body → DTO validation → service layer arithmetic (balance derivation, invariant sums) → Postgres `BIGINT` column → API response.

The representation choice affects: precision guarantees, arithmetic safety, serialization, and JS `number` limits for large values.

## Decision

Represent all monetary amounts as `BIGINT` in minor units (cents, pence, centavos) in the database and as `bigint` (native JS) in application code.

## Options Considered

### Option A: JavaScript `number` (float64)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | High |
| Team familiarity | High |
| Portfolio signal | Low |

**Pros:**
- No library required, JSON-native
- Familiar to all JS developers

**Cons:**
- `Number.MAX_SAFE_INTEGER` = 9,007,199,254,740,991 — exceeded by high-value accounts in minor units
- `0.1 + 0.2 !== 0.3` — floating-point errors in sums corrupt the invariant check
- Categorically wrong for financial arithmetic

---

### Option B: Decimal.js (arbitrary precision)

| Dimension | Assessment |
|---|---|
| Complexity | Med |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | Med |

**Pros:**
- Handles fractional minor units (rare but possible with FX)
- Human-readable decimal representation

**Cons:**
- Library dependency with non-trivial API surface
- Must serialize to string for JSON (breaks numeric type in responses)
- Overkill: minor units are always integers — fractional cents don't exist post-conversion

---

### Option C: Native `bigint` + BIGINT storage

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | High |

**Pros:**
- No floating-point: exact integer arithmetic for all sums
- `BIGINT` in Postgres stores up to 9,223,372,036,854,775,807 minor units
- No library dependency
- Fast — native CPU integer operations

**Cons:**
- JSON doesn't support `bigint` natively — must serialize to `number` or string in responses (amounts within `Number.MAX_SAFE_INTEGER` range are fine as `number`)
- Prisma returns `BIGINT` as `bigint` by default — minor serialization ceremony

---

## Trade-off Analysis

Financial arithmetic must be exact. `number` is disqualified. Between `Decimal.js` and `bigint`: minor units are integers by definition (conversion from decimal happens at input boundary), so arbitrary precision buys nothing. Native `bigint` is simpler, faster, and dependency-free.

JSON serialization of `bigint`: amounts in ledgers rarely exceed `Number.MAX_SAFE_INTEGER` (~92 trillion cents), so serializing as `number` in API responses is safe in practice. If extreme values are needed, serialize as string.

## Decision Rationale

Native `bigint` + Postgres `BIGINT`. No library needed, exact integer arithmetic, correct by construction. The only ceremony is Prisma's `BigInt` → `bigint` deserialization and JSON response serialization.

## Consequences

- **Easier:** Invariant sum checks are exact — no floating-point drift
- **Harder:** JSON serialization requires explicit `Number(amount)` or string cast in response DTOs
- **Revisit if:** FX conversion requires sub-cent precision in intermediate calculations — use `Decimal.js` only for FX math, not storage
