# 0002. Redis + Lua for seat holds, with a Postgres partial unique index as the final safeguard

- **Status:** Proposed
- **Date:** 2026-10-06

## Context

Holding seats is the most contended operation: many users target the same few seats at once. A hold of 1–6 seats must be all-or-nothing and must expire after 10 minutes. Above all, a seat must never be confirmed twice.

## Options considered

1. **Postgres row locks** (`SELECT … FOR UPDATE` on seat rows, ordered to avoid deadlocks).
   - ✅ One system, transactional, simple to reason about.
   - ❌ Contended rows serialize on the DB, holding connections and locks under load. Expiry needs timestamps plus cleanup.
2. **Optimistic locking** (a version column, retry on conflict).
   - ✅ No held locks.
   - ❌ A retry storm under heavy contention on the same rows.
3. **Redis `SET NX PX`, one key per seat, via a Lua script.**
   - ✅ Sub-millisecond, atomic across all requested keys, built-in TTL. Keeps contention off Postgres.
   - ❌ A second system with no shared transaction. Durability depends on Redis.

## Decision

Use **option 3 for winner selection**, with **Postgres as the source of truth and final safeguard**:

- `acquire.lua` checks and sets all seat keys atomically (value = `holdId`, TTL = hold + 30 s grace). `release.lua` is compare-and-delete.
- Key format `seat:{eventId}:{seatId}`: the hash tag keeps an event's seats in one cluster slot.
- After acquiring, check in Postgres that no requested seat is already `CONFIRMED`, then insert the hold. If that fails, compensate by releasing the keys.
- The **partial unique index on `booking_seats(seat_id) WHERE status = 'CONFIRMED'`** guarantees no double booking even if Redis misbehaves.

See [system design §7.1 and §8](../system-design.md#8-concurrency-and-consistency-strategy).

## Consequences

- Contention stays off Postgres, and holds are fast.
- Redis and Postgres writes aren't atomic together, so the design relies on ordering, compensation and TTL self-healing. This must be covered by integration tests (crash between steps, partial overlap, expiry).
- We need a Redis failure policy ([ADR 0003](0003-redis-failure-policy.md)).
- **Interview trade-off:** option 1 would be simpler and is a valid choice at lower scale. We choose option 3 to keep contention off the database, and we keep option 1's guarantee through the constraint.
