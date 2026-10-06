# SeatLock: Implementation Plan and Tracker

| | |
| --- | --- |
| **Budget** | ~50–70 hours, ~12–15 h/week (≈ 5–6 weeks) |
| **Started** | 2026-10-05 |
| **Related** | [System design](system-design.md) · [Architecture](architecture.md) · [ADRs](adr/) |

**How to use this doc:** tick tasks as they merge (`- [x]`), update the status table, and log decisions or scope changes at the bottom. Phases are ordered by dependency, not fixed to calendar weeks. Estimates are rough and get revised as we learn.

**Legend:** ✅ done · 🔄 in progress · ⏳ not started · ⏸️ deferred

---

## Status at a glance

| Phase | Goal | Est. | Status |
| --- | --- | --- | --- |
| [0. Foundation](#phase-0-foundation) | Tooling, Docker, DB plumbing | 6 h | ✅ |
| [1. Design](#phase-1-design-docs) | Agree the design before building | 4 h | 🔄 |
| [2. Schema + auth](#phase-2-schema-auth-ci) | All tables, Better Auth, CI | 8 h | ⏳ |
| [3. Events + seats](#phase-3-events-and-seat-maps) | Admin creates events, users see seat maps | 5 h | ⏳ |
| [4. Seat holds](#phase-4-seat-holds-the-core-problem) | Atomic multi-seat holds, expiry | 10 h | ⏳ |
| [5. Checkout + payments](#phase-5-checkout-payments-webhooks) | Idempotent checkout, mock gateway, webhooks | 12 h | ⏳ |
| [6. Prove it](#phase-6-prove-it-load-tests-and-hardening) | k6 evidence, Redis failure, observability | 8 h | ⏳ |
| [7. Ship](#phase-7-ship-it) | Deploy to AWS (demo), frontend, polish | 10 h | ⏳ |
| | **Total** | **~63 h** | |

---

## Phase 0: Foundation ✅

> Deliverable: a clean, tested NestJS skeleton with Postgres, Docker and documentation conventions.

- [x] NestJS 12 (ESM) scaffold, pnpm, Node 24 pinned
- [x] oxlint (type-aware), Prettier, Husky + lint-staged, commitlint + Commitizen
- [x] `@/` path alias, zod env validation via `@nestjs/config`
- [x] Swagger (OpenAPI) + Scalar docs at `/docs` (non-prod)
- [x] Drizzle ORM + drizzle-kit, `DatabaseModule`, prod migration runner
- [x] Health checks: `/health` (liveness), `/health/ready` (DB)
- [x] Docker Compose (Postgres 18), multi-stage production Dockerfile
- [x] README: setup, branching strategy, commit conventions
- [ ] `.env.example` includes `DATABASE_URL` and `DB_POOL_MAX` (missing from the committed version)
- [ ] Run `pnpm format` once to apply the new Prettier style to older files

## Phase 1: Design docs 🔄

> Deliverable: agreed design, so implementation is mostly typing.

- [x] System design: problem, flows, schema, concurrency, failure modes
- [x] Architecture: C4 L1–L3, AWS production and demo diagrams, CI/CD
- [x] ADRs: 0001 Drizzle, 0002 Redis + Lua holds, 0003 Redis failure policy
- [ ] Review and resolve [open questions Q1–Q8](system-design.md#12-open-questions)
- [ ] Mark ADRs 0002 and 0003 Accepted (or revise them)
- [ ] Decide the DTO approach (`nestjs-zod` proposed) and the demo DB (container vs RDS)

## Phase 2: Schema, auth, CI

> Deliverable: every table migrated, users can register and log in, and CI runs on every push.

**Schema** ([§6](system-design.md#6-data-model))
- [ ] Postgres enums: `event_status`, `hold_status`, `booking_status`, `booking_seat_status`, `payment_status`, `idem_status`
- [ ] Better Auth tables (`user`, `session`, `account`, `verification`) generated with the Better Auth CLI into Drizzle schema
- [ ] Tables in their modules' `*.schema.ts`: events, seats, holds, hold_seats, bookings, booking_seats, payments, processed_webhooks, idempotency_keys, outbox
- [ ] Constraints: seats unique `(event_id, section, row, number)`, `bookings.hold_id` unique, `payments.provider_ref` unique, **partial unique `booking_seats(seat_id) WHERE status = 'CONFIRMED'`**, check constraints on amounts
- [ ] `src/database/relations.ts` (central relations)
- [ ] Migration generated and reviewed *(user runs `db:generate` / `db:migrate`)*
- [ ] Test: inserting a second CONFIRMED `booking_seats` row for the same seat fails

**Platform**
- [ ] DTO validation (`nestjs-zod`, if accepted) + global exception filter with a consistent error shape
- [ ] Redis in Docker Compose + `RedisModule` (ioredis), `REDIS_URL` env var
- [ ] Testcontainers setup for integration tests (Postgres + Redis)

**Auth**
- [ ] Better Auth setup: email + password, Drizzle adapter, admin plugin (roles), `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` env vars
- [ ] NestJS integration via `@thallesp/nestjs-better-auth` (mounts `/api/auth/*`, global session guard, `@AllowAnonymous()` for public routes). Note: Nest's body parser must be disabled for the auth route, as the library's docs describe.
- [ ] `RolesGuard` reading `session.user.role` for `/admin/*`
- [ ] CORS + trusted origins + cross-subdomain cookie config for the SPA
- [ ] Seed script: one admin user

**CI**
- [ ] GitHub Actions: install → lint → format:check → typecheck → unit → integration (Testcontainers) → build
- [ ] Branch protection on `dev` / `staging` / `prod` requires CI to pass

## Phase 3: Events and seat maps

> Deliverable: create an event and see its seat map through the API.

- [ ] `POST /admin/events`, `POST /admin/events/{id}/seats` (generate sections × rows × numbers in one transaction), `POST /admin/events/{id}/publish`
- [ ] `GET /events`, `GET /events/{id}`, `GET /events/{id}/seats` (derived `AVAILABLE` / `HELD` / `SOLD`)
- [ ] Swagger docs for every endpoint, including error responses
- [ ] Tests: seat generation is idempotent or rejects duplicates, draft events aren't public

## Phase 4: Seat holds (the core problem)

> Deliverable: concurrent holds on the same seat always produce exactly one winner.

- [ ] `acquire.lua` (all-or-nothing check-and-set, returns conflicting seats) and `release.lua` (compare-and-delete)
- [ ] `SeatLockService` wrapping the scripts (`EVALSHA` with a fallback to `EVAL`)
- [ ] `POST /events/{id}/holds`: Redis acquire → DB "sold?" check + insert, all in one transaction → release on failure
- [ ] `DELETE /holds/{id}` (owner only)
- [ ] Max active holds per user per event (Q2)
- [ ] Redis unavailable → `503` + `Retry-After` (ADR 0003)
- [ ] **Worker entry point** (`src/worker.ts`, Nest standalone app) + hold sweeper (`SKIP LOCKED` batches)
- [ ] Integration tests:
  - [ ] N parallel requests for the same seat → exactly 1 success
  - [ ] partial overlap (A3–A5 vs A4–A6) → one wins entirely, the other gets nothing
  - [ ] expiry: after TTL the seat can be held again, and the sweeper marks EXPIRED
  - [ ] crash simulation: Redis acquired, DB insert fails → keys released
  - [ ] a sold seat can't be held

## Phase 5: Checkout, payments, webhooks

> Deliverable: a full hold → pay → confirm flow that survives retries and duplicate webhooks.

- [ ] `idempotency_keys` handling (interceptor or service): replay, 409 in progress, 422 hash mismatch
- [ ] `POST /checkout`: lock the hold, create booking + booking_seats + payment, call the gateway
- [ ] **Mock gateway service** (`mock-gateway/`, its own Dockerfile, in Compose): configurable success rate, duplicate probability and delay; HMAC-signed webhooks
- [ ] `POST /webhooks/payments`: signature + timestamp check, `processed_webhooks` dedup in the same transaction, guarded transitions
- [ ] Late-payment rule: success after expiry → `REFUND_REQUIRED` / `REFUND_PENDING` (documented)
- [ ] Outbox: confirmation writes an outbox row; the worker relays it to email (log locally, SES in AWS)
- [ ] `GET /me/bookings`
- [ ] Integration tests:
  - [ ] retrying checkout with the same key gives the same response and one booking
  - [ ] the same key with a different body → 422
  - [ ] a duplicate webhook is a no-op
  - [ ] success then failure webhook (out of order) leaves the booking CONFIRMED
  - [ ] a late webhook leads to a refund state

## Phase 6: Prove it (load tests and hardening)

> Deliverable: measured evidence that no double bookings happen under load.

- [ ] k6 **contention test**: many virtual users hold and pay for the same seat → assert exactly 1 CONFIRMED and 0 duplicates (verified by SQL)
- [ ] k6 **throughput test**: seat map browsing and holds → record p50/p95/p99 and RPS
- [ ] Results written to `docs/load-tests.md` (machine spec, numbers, graphs)
- [ ] Redis failure test: stop Redis mid-test → holds 503, nothing else breaks, no double booking
- [ ] Structured logging (pino) with request and correlation IDs
- [ ] Metrics: holds attempted / succeeded / conflicted / expired, webhook duplicates, late payments
- [ ] Rate limiting (`@nestjs/throttler`) on auth and holds

## Phase 7: Ship it

> Deliverable: a live demo link and a polished repo.

- [ ] Frontend (AI-built): event list, seat map, hold countdown, checkout, my bookings
- [ ] Demo deployment per [architecture §5](architecture.md#5-aws-demo-deployment-low-cost): EC2 + Compose + Caddy, S3 + CloudFront for the SPA
- [ ] CD: GitHub Actions (OIDC) → ECR → migrate → compose up → smoke test
- [ ] README: architecture diagram, design decisions, trade-offs, load test results, known limitations
- [ ] Demo video or GIF
- [ ] Resume bullets using **only measured numbers**

## Stretch goals ⏸️

- [ ] Live seat updates (WebSockets / SSE) via Redis pub/sub
- [ ] Virtual waiting room for high-demand events
- [ ] Postgres fallback for Redis outages (with fencing), to supersede ADR 0003
- [ ] Production-target infrastructure as code (Terraform/CDK) for the ECS design
- [ ] OpenTelemetry tracing

---

## Definition of done (every task)

- Code follows `CLAUDE.md` conventions, with Swagger docs on new endpoints
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass, and integration and e2e tests pass where relevant
- A migration, if any, is generated, reviewed and committed with its schema change
- Docs are updated when behaviour or design changes (system design, ADR, README)
- PR into `dev` with the template filled in

## Decision and change log

| Date | Change | Why |
| --- | --- | --- |
| 2026-10-05 | Drizzle ORM chosen ([ADR 0001](adr/0001-drizzle-orm.md)) | SQL-first locking support, ESM-friendly |
| 2026-10-06 | `holds.seat_ids` array → `hold_seats` table; idempotency moved to its own table; outbox added | See [system design §6.3](system-design.md#63-changes-from-the-original-plan-and-why) |
| 2026-10-06 | Sold check moved after the Redis acquire; Redis TTL = hold + 30 s | Closes the stale-check race without SOLD markers ([§8.2](system-design.md#82-why-the-sold-check-runs-after-the-redis-lock)) |
| 2026-10-06 | Auth via Better Auth instead of custom JWT | Don't hand-roll auth. Keep the effort on concurrency. |
| 2026-10-06 | AWS diagrams in PlantUML (official AWS icons) | Exact, editable diagrams instead of AI-generated images |
| 2026-10-06 | Two AWS designs: production target + low-cost demo | Interview depth plus affordable live demo |
