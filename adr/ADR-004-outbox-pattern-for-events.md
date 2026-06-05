# ADR-004: Event Publishing Strategy

**Status:** Accepted
**Date:** 2026-05-31
**Deciders:** Gabriel Gonçalves

## Context

After a journal is posted or reversed, downstream consumers need to be notified via events (`journal.posted`, `journal.reversed`, `reconciliation.completed`). These events must not be lost even if RabbitMQ is temporarily unavailable at the moment of the write.

The core tension: if we publish to RabbitMQ inside the same DB transaction, we cannot atomically commit both. If we publish after commit, a crash between commit and publish loses the event. We need at-least-once delivery with no event loss.

## Decision

Use the transactional outbox pattern: write events to an `outbox` table in the same DB transaction as the journal insert, then relay to RabbitMQ via a separate BullMQ worker polling the outbox.

## Options Considered

### Option A: Direct publish (in-process, after DB commit)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness risk | High |
| Team familiarity | High |
| Portfolio signal | Low |

**Pros:**
- Simple — call RabbitMQ client after `prisma.$transaction`
- No additional table or worker

**Cons:**
- Process crash between commit and publish = lost event
- RabbitMQ unavailability causes journal POST to fail or event to be silently dropped
- No retry mechanism without additional complexity

---

### Option B: Outbox pattern (transactional outbox)

| Dimension | Assessment |
|---|---|
| Complexity | Med |
| Correctness risk | Low |
| Team familiarity | Med |
| Portfolio signal | High |

**Pros:**
- Atomicity: outbox row and journal are committed together — no lost events
- RabbitMQ unavailability is decoupled from the write path
- Retry with backoff built into relay worker
- Dead-letter tracking via `status = 'FAILED'`, `attempts`, `last_error`

**Cons:**
- Additional `outbox` table + relay worker (BullMQ repeatable job)
- Polling introduces up to 500ms event delivery latency
- Must handle duplicate delivery (relay retries = at-least-once, consumers must be idempotent)

---

### Option C: Event sourcing

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Correctness risk | Low |
| Team familiarity | Low |
| Portfolio signal | High |

**Pros:**
- Audit log is the source of truth
- Replay capability

**Cons:**
- Fundamental architecture change — incompatible with current relational data model
- Significant complexity: projections, snapshots, event schema versioning
- Far exceeds scope for this system

---

## Trade-off Analysis

Direct publish is disqualified by the lost-event failure mode — a financial ledger must not silently drop events. Event sourcing is the right long-term architecture but wrong scope here. The outbox pattern adds one table and one worker in exchange for at-least-once delivery with full observability. The 500ms polling lag is acceptable for this use case.

## Decision Rationale

Outbox pattern. The implementation cost is bounded (schema already defined in SPEC, BullMQ repeatable job is ~50 LOC). The correctness gain — no lost events under any failure scenario — is non-negotiable for a ledger.

## Consequences

- **Easier:** Safe retries, dead-letter tracking, RabbitMQ downtime doesn't affect write path
- **Harder:** Consumers must be idempotent (at-least-once delivery means duplicate events possible)
- **Revisit if:** Event delivery latency must drop below 100ms — use Postgres LISTEN/NOTIFY to trigger relay instead of polling
