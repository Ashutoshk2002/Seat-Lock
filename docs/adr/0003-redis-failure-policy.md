# 0003. Fail closed when Redis is unavailable

- **Status:** Proposed
- **Date:** 2026-10-06

## Context

Seat holds are acquired in Redis ([ADR 0002](0002-redis-lua-seat-holds.md)). If Redis is unreachable, the system must either stop creating holds or create them another way.

## Options considered

1. **Fail closed:** `POST /holds` returns `503` while Redis is down.
   - ✅ Simple, and impossible to double-hold.
   - ❌ No new holds during the outage.
2. **Fall back to Postgres row locking** for holds.
   - ✅ Holds keep working.
   - ❌ During switchover and switchback, some instances use Redis and others use Postgres. Two lock systems that don't see each other's locks is exactly the double-hold window we're trying to prevent. Fixing that needs coordination (e.g. a global mode flag with fencing), which adds a lot of complexity.

## Decision

**Fail closed** for new holds. Everything that only needs Postgres keeps working:
- seat map reads;
- checkout of existing holds (validated against the DB hold);
- payment webhooks;
- hold expiry.

Return `503` with a `Retry-After` header. `/health/ready` stays `200` (Postgres is fine), so instances aren't pulled from the load balancer. A metric and alarm fire on Redis errors.

## Consequences

- Correctness is never at risk from Redis. Availability of *new holds* is.
- Production mitigates outages with ElastiCache Multi-AZ automatic failover.
- The Postgres fallback (option 2) stays documented as future work, along with the coordination it would need. That makes a good interview discussion.
