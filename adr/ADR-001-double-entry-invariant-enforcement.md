# ADR-001: Double-Entry Invariant Enforcement

**Status:** Accepted
**Date:** 2026-05-31
**Deciders:** Gabriel Gonçalves

## Context

INV-01 requires that for every posted journal, debits equal credits per currency. This invariant is the core correctness guarantee of the ledger. The question is where to enforce it: in the application layer only, in the database layer only, or in both.

Application-layer checks run before any DB write and can return structured error codes (`INVARIANT_VIOLATION`). DB-layer checks (deferred triggers) run at transaction commit and are the last line of defense against bugs, direct SQL access, or future code paths that bypass the service layer.

## Decision

Enforce at both layers: `JournalService` validates before writing, and a deferred DB trigger validates at commit time.

## Options Considered

### Option A: Application layer only

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | High |
| Team familiarity | High |
| Portfolio signal | Low |

**Pros:**
- Single enforcement point, easier to reason about
- Structured error responses with domain codes

**Cons:**
- DB is unprotected from direct writes, migrations, or future bypasses
- No defense-in-depth; one bug in service = corrupted ledger

---

### Option B: Database trigger only

| Dimension | Assessment |
|---|---|
| Complexity | Med |
| Correctness risk | Med |
| Team familiarity | Low |
| Portfolio signal | Med |

**Pros:**
- Enforcement is always active regardless of code path

**Cons:**
- Trigger errors surface as generic DB exceptions, not domain error codes
- Logic lives in SQL, harder to test and version alongside application code
- No early rejection — DB write attempted before invariant checked

---

### Option C: Both layers (app + deferred trigger)

| Dimension | Assessment |
|---|---|
| Complexity | Med |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | High |

**Pros:**
- App layer gives structured `INVARIANT_VIOLATION` with early rejection
- DB trigger is a hard backstop for out-of-band writes, bugs, or future code paths
- Defense-in-depth — both layers must fail simultaneously to corrupt the ledger

**Cons:**
- Logic duplicated across two layers
- Trigger must be kept in sync with app logic (both use per-currency check)

---

## Trade-off Analysis

For a financial ledger, the cost of a corrupted invariant vastly exceeds the cost of maintaining two enforcement points. The app-layer check is the primary UX path (structured errors, early rejection). The DB trigger is the correctness backstop. This is the standard pattern for financial systems.

## Decision Rationale

Option C. The ledger's core value proposition is correctness. Defense-in-depth costs one trigger and a SQL function — a worthwhile trade for a hard guarantee that no code path can silently violate INV-01.

## Consequences

- **Easier:** Detecting invariant violations from any code path, including migrations and direct DB access
- **Harder:** Keeping trigger logic in sync with app layer when invariant semantics change
- **Revisit if:** The deferred trigger causes unacceptable performance at high journal-post throughput
