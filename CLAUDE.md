# Seat Lock

NestJS 12 backend for holding and booking seats. The core problem is **concurrency**: two users must never hold or book the same seat. Treat any code that touches holds or bookings as correctness-critical.

See `README.md` for full setup, branching and commit conventions. This file holds what you need while working in the code.

**Design source of truth:** `docs/system-design.md` (flows, schema, concurrency rules), `docs/architecture.md` (C4, AWS), `docs/plan.md` (phases + tracker), `docs/adr/` (decisions). Read the relevant section before implementing a feature. If the code must diverge from the design, update the doc (or add an ADR) in the same change and tell the user. Tick tasks in `docs/plan.md` when they're done.

## Restricted actions: never do these

- **Never read, open, print, search or modify `.env` or any `.env.*` file** (except `.env.example`). This includes `cat`, `grep`, `source`, editors and tools that load it. If a task needs an env value, ask the user.
- **Never run migrations or any database command.** That means:
  - no `pnpm db:*` scripts (`db:generate`, `db:migrate`, `db:migrate:prod`, `db:studio`)
  - no `drizzle-kit`, and no `node dist/database/migrate.js`
  - no `psql`, and no `docker compose` commands against the `postgres` service
  - no scripts that connect to the database
- **Never run `pnpm test:e2e` or `pnpm start*`**: they connect to the database.

For schema work, edit the `*.schema.ts` files and then tell the user which commands to run (`pnpm db:generate`, then `pnpm db:migrate`). Review the generated SQL only if they share it.

## Commands

```bash
# Safe for Claude to run:
pnpm lint             # oxlint, type-aware
pnpm typecheck        # tsc --noEmit (Vitest does NOT type-check)
pnpm test             # unit tests (*.spec.ts, next to the source)
pnpm build            # nest build -> dist/
pnpm format           # prettier --write .

# User-only (Claude must NOT run these, see "Restricted actions" above):
# pnpm test:e2e, pnpm start:dev, pnpm db:generate, pnpm db:migrate, pnpm db:studio
```

Use **pnpm only**: never npm or yarn.

Before calling a task done, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. If the change needs e2e tests or a migration, say so and give the user the commands to run.

## Stack

TypeScript 6 (strict) · ESM (`"type": "module"`, `nodenext`) · Node 24 · PostgreSQL 18 + Drizzle ORM 0.45 · zod · `@nestjs/config` · `@nestjs/swagger` + Scalar · `@nestjs/terminus` · Vitest + Supertest · oxlint · Prettier.

## Layout

```
src/
  main.ts                  bootstrap: shutdown hooks, docs (non-prod), listen
  app.module.ts            root module
  config/                  env schema (zod) + validation
  database/                Drizzle client module, schema barrel, prod migrate runner
  common/                  shared Nest building blocks (docs, filters, guards, ...)
  modules/<feature>/       one folder per feature (feature-based, NOT layer-based)
migrations/                generated SQL migrations (committed, never hand-edit after merge)
test/                      e2e tests
```

A feature module looks like:

```
modules/seats/
  seats.module.ts  seats.controller.ts  seats.service.ts  seats.repository.ts
  seats.schema.ts  dto/  seats.service.spec.ts
```

- **Controller**: HTTP only (routes, DTOs, status codes, Swagger decorators). No business logic.
- **Service**: business rules and transactions. Doesn't know about HTTP.
- **Repository**: Drizzle queries only.
- Modules talk to each other **only through exported services**, never another module's repository.
- `common/` must not import from `modules/`.

## Code conventions

- **Imports need `.js` extensions** (ESM `nodenext`), including for aliases. An extensionless import fails with TS2307.
  - Across folders: `import { X } from "@/modules/seats/seats.service.js";`
  - Within a feature: `import { Y } from "./dto/hold-seat.dto.js";`
- `@/*` maps to `src/*`. Don't add `baseUrl`; TS 6 deprecates it.
- Prettier: double quotes, semicolons, `trailingComma: "es5"`. Let Prettier format; don't hand-format.
- Use `import type` for type-only imports (`isolatedModules`).
- Read config through `ConfigService<Env, true>` with `{ infer: true }`, never `process.env` (the exception is standalone scripts like `src/database/migrate.ts`).
- **New env var:** add it to `src/config/env.validation.ts`, `.env.example` and the README table, all in the same change.
- Document every endpoint with `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOperation`, response decorators, including error responses like 409).
- DTO validation approach (zod/`nestjs-zod` vs class-validator) is **not decided yet**. Ask before introducing one.

## Database (Drizzle)

- Inject the client with `@Inject(DRIZZLE) private readonly db: Database` (from `@/database/database.constants.js`).
- Tables go in `modules/<feature>/<feature>.schema.ts` and are re-exported from `src/database/schema.ts`.
- `casing: "snake_case"` is on: write camelCase keys in TS, and columns become snake_case in Postgres.
- Relations use the Drizzle 0.x `relations()` API. `defineRelations` is v1 beta and **not available**.
- **Concurrency rules for holds and bookings:**
  - Never read → check in JS → write. Use one atomic conditional `update ... where ... returning()`, or `select ... .for("update")` inside `db.transaction`.
  - Enforce invariants in the DB too: unique constraints, partial unique indexes, check constraints.
  - Expire holds by timestamp (`expiresAt` compared with `now()` in SQL), never with timers or in-memory state.
- The app must stay **stateless** (no in-memory caches, sessions or timers), because it runs as multiple containers.

### Migrations

- Workflow (the **user** runs the commands): Claude edits the schema → the user runs `pnpm db:generate` → the generated SQL is reviewed → the user runs `pnpm db:migrate` → the schema, the SQL and `migrations/meta/` are committed together.
- If a change is a column or table rename, warn the user that drizzle-kit will ask "rename or drop + create", and that the wrong answer loses data.
- Never edit a merged migration. Never run `drizzle-kit push` against a shared database. Migrations are forward-only.
- Hand-written SQL or data backfills: the user runs `pnpm db:generate --custom --name=<name>`, then Claude may write the SQL into the created file.
- Production runs migrations with `node dist/database/migrate.js` as a deploy step, never on app boot.

## Testing

- Unit tests sit next to the code (`*.spec.ts`); e2e tests go in `test/*.e2e-spec.ts`. Vitest globals are enabled.
- e2e tests use `DATABASE_URL` from `vitest.config.e2e.ts` (defaults to the compose DB).
- Concurrency-sensitive logic needs a test that runs concurrent requests against real Postgres.

## Environment gotchas

- Local Postgres runs in Docker on **port 5433**, not 5432; the host machine has its own Postgres on 5432.
- `DATABASE_URL` is required, so the app refuses to start without it.
- `/docs` and `/openapi.json` are disabled when `NODE_ENV=production`.
- Health checks: `/health` is liveness (no DB check), `/health/ready` is readiness (checks the DB).

## Git workflow

- Branches: `<type>/<kebab-description>` (`feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `test/`, `perf/`), cut from `dev`.
- Commits: Conventional Commits, enforced by commitlint. Scopes are single words: `feat(holds): add seat hold expiry`.
- Flow: feature branch → PR into `dev` → `staging` → `prod`. Direct pushes to `dev`, `staging` and `prod` are blocked.
- Never bypass the Git hooks with `--no-verify`.
- Don't commit, push or open PRs unless asked.
