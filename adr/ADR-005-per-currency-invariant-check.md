# ADR-005: Invariant Check Granularity

**Status:** Accepted
**Date:** 2026-05-31
**Deciders:** Gabriel Gonçalves

## Context

INV-01 requires that debits equal credits in a posted journal. The question is whether this check is performed globally (sum all debits and all credits across all currencies) or per-currency (sum debits and credits separately for each currency in the journal).

This matters because ledger-core supports multi-currency journals (e.g., FX journals where USD debits are paired with BRL credits). A global sum check would allow cross-currency imbalances to cancel each other out silently.

## Decision

Enforce the invariant per currency: `Σ debits = Σ credits` must hold independently for each currency present in the journal.

## Options Considered

### Option A: Global invariant (sum across all currencies)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | High |
| Team familiarity | High |
| Portfolio signal | Low |

**Pros:**
- Simpler implementation — one sum comparison

**Cons:**
- Allows cross-currency cancellation: 100 USD debit + 100 BRL credit would pass, producing an unbalanced ledger per currency
- Incorrect for any system that supports multiple currencies
- FX journals would need special-casing anyway

---

### Option B: Per-currency invariant

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | High |

**Pros:**
- Correct by construction for multi-currency journals
- FX journals explicitly modeled with `fx_rate`, `fx_base_currency`, `fx_quote_currency` — the rate documents the cross-currency relationship, but each currency's entries must still balance independently
- Natural grouping: `Map<currency, {debits, credits}>` — straightforward to implement
- INV-05 (entry currency must match account currency) pairs cleanly with per-currency check

**Cons:**
- Slightly more code than a global sum — iterate over currency groups rather than flat sum

---

## Trade-off Analysis

Global invariant is semantically incorrect for multi-currency ledgers — there is no meaningful exchange rate at which 100 USD = 100 BRL, so allowing them to cancel is a bug. Per-currency check is the correct model and adds negligible implementation complexity. The SPEC already defines this: "evaluated per currency."

For FX journals: the application records the exchange rate as metadata (`fx_rate`, `fx_base_currency`, `fx_quote_currency`) but each currency's entries must still independently balance. This is intentional — the rate is for reporting and auditing, not for relaxing the invariant.

## Decision Rationale

Per-currency. This is mathematically correct for any multi-currency ledger and already specified in INV-01. The implementation is a `groupBy(currency)` followed by per-group sum comparison — minimal complexity for a hard correctness requirement.

## Consequences

- **Easier:** Multi-currency journal support is correct by default; no special-casing for FX transactions
- **Harder:** Journal authors must ensure each currency's entries balance independently (documented in API spec)
- **Revisit if:** A legitimate use case requires cross-currency netting — would require explicit FX entry pairs and a relaxed invariant mode
