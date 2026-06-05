# ADR-002: ID Generation Strategy

**Status:** Accepted
**Date:** 2026-05-31
**Deciders:** Gabriel Gonçalves

## Context

Every entity (accounts, journals, entries, outbox events, fx_rates, reconciliation_runs) needs a unique identifier. The choice affects: sort behavior, index locality, URL readability, client-side ID generation, and collision probability.

IDs are stored as `TEXT` in Postgres, so wire format is flexible. The system generates IDs at the application layer before DB insertion (needed for outbox correlation and idempotency key handling).

## Decision

Use ULID (Universally Unique Lexicographically Sortable Identifier) for all entity IDs.

## Options Considered

### Option A: UUIDv4

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | Low |
| Team familiarity | High |
| Portfolio signal | Low |

**Pros:**
- Universal library support, no additional dependency
- Collision probability negligible in practice

**Cons:**
- Random — no natural sort order, causes index fragmentation on insert-heavy tables
- Not human-readable or debuggable in logs
- 128-bit random with no temporal component

---

### Option B: UUIDv7

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | Med |

**Pros:**
- Time-ordered, reduces index fragmentation
- Standard UUID format — broad tooling support

**Cons:**
- Smaller random component than UUIDv4 in some implementations
- Library support less mature than UUIDv4 in Node.js ecosystem

---

### Option C: ULID

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | High |

**Pros:**
- Time-ordered (48-bit ms timestamp prefix) — natural sort, better index locality for append-heavy entries table
- URL-safe, 26-char Crockford base32 — readable in logs and API responses
- 80-bit random component — collision-safe
- Monotonic sort within the same millisecond (with monotonic ULID factory)
- Application-layer generation — no DB round-trip for ID

**Cons:**
- Requires `ulid` npm package (tiny, well-maintained)
- Not UUID-format — some tools expect UUID shape

---

## Trade-off Analysis

`entries` will be the highest-volume table (append-only, immutable). Time-ordered IDs reduce B-tree fragmentation on `idx_entries_account_created`. ULID also makes IDs debuggable in logs and cursor-based pagination more intuitive. The `ulid` package is a one-line dependency with no meaningful complexity cost.

## Decision Rationale

ULID. The entries table's access pattern (append-heavy, cursor-paginated) benefits most from time-ordered IDs. Readability in logs and API responses is a secondary gain with no cost.

## Consequences

- **Easier:** Cursor-based pagination (ULID sort = chronological sort), log correlation
- **Harder:** Interop with systems that expect UUID format in headers or external APIs
- **Revisit if:** A dependency strictly requires UUID format — UUIDv7 is the fallback
