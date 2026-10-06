# Seat Lock

Backend service for Seat Lock, built with [NestJS](https://nestjs.com).

SeatLock is event ticket booking that guarantees a seat is never sold twice, even when hundreds of users click the same seat at once: atomic multi-seat holds with a TTL, idempotent checkout, and deduplicated payment webhooks.

**Design docs:** [System design](docs/system-design.md) · [Architecture (C4 + AWS)](docs/architecture.md) · [Plan & tracker](docs/plan.md) · [ADRs](docs/adr/)

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Database](#database)
- [Health Checks](#health-checks)
- [Docker](#docker)
- [API Docs](#api-docs)
- [Scripts](#scripts)
- [Code Quality](#code-quality)
- [Branching Strategy](#branching-strategy)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [License](#license)

## Tech Stack

| Area            | Tool                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Framework       | NestJS 12 (ESM)                                                                                                     |
| Language        | TypeScript                                                                                                          |
| Package manager | pnpm                                                                                                                |
| Database        | PostgreSQL 18 + [Drizzle ORM](https://orm.drizzle.team) (`drizzle-kit` for migrations)                              |
| Health checks   | `@nestjs/terminus`                                                                                                  |
| Containers      | Docker (multi-stage image) + Docker Compose                                                                         |
| Testing         | Vitest + Supertest                                                                                                  |
| API docs        | `@nestjs/swagger` (OpenAPI) + [Scalar](https://scalar.com)                                                          |
| Linting         | [oxlint](https://oxc.rs) (type-aware)                                                                               |
| Formatting      | Prettier                                                                                                            |
| Git hooks       | Husky + lint-staged                                                                                                 |
| Commits         | [Commitizen](https://github.com/commitizen/cz-cli) + [commitlint](https://commitlint.js.org) (Conventional Commits) |

## Prerequisites

- **Node.js 24+**: the version is pinned in `.nvmrc`, so run `nvm use` in the project folder.
- **pnpm 10**: run `corepack enable` once; Corepack then uses the version pinned in `package.json`.
- **Docker**: for the local Postgres database (Docker Desktop on macOS/Windows).

## Getting Started

```bash
git clone https://github.com/Ashutoshk2002/Seat-Lock.git
cd Seat-Lock
nvm use
pnpm install           # also installs the Husky git hooks
cp .env.example .env
docker compose up -d   # starts Postgres on localhost:5433
pnpm db:migrate        # applies database migrations
pnpm start:dev         # http://localhost:3000
```

The app runs on your machine (fast watch mode and debugging); only Postgres runs in Docker.

### Environment Variables

All variables are documented in [`.env.example`](.env.example). Copy it to `.env` and adjust the values locally. `.env` is git-ignored and must never be committed.

| Variable       | Default        | Description                                                        |
| -------------- | -------------- | ------------------------------------------------------------------ |
| `NODE_ENV`     | `development`  | One of `development`, `test`, `staging`, `production`              |
| `PORT`         | `3000`         | Port the HTTP server listens on                                    |
| `DATABASE_URL` | – (required)   | Postgres connection string, e.g. `postgres://user:pass@host:5432/db` |
| `DB_POOL_MAX`  | `10`           | Max connections in the pool (use `1` on serverless)                |

`.env` is loaded at startup by `@nestjs/config` and validated with zod in [`src/config/env.validation.ts`](src/config/env.validation.ts). If a value is missing or invalid, the app refuses to start and prints which variable is wrong. Real environment variables take precedence over `.env`.

Read config through the typed `ConfigService` instead of `process.env`:

```ts
constructor(private readonly config: ConfigService<Env, true>) {}

const port = this.config.get('PORT', { infer: true }); // number
```

**Adding a new variable:** add it to the schema in `env.validation.ts`, to `.env.example`, and to this table, all in the same PR.

## Database

PostgreSQL accessed through [Drizzle ORM](https://orm.drizzle.team). The client is provided globally by `DatabaseModule`:

```ts
import { DRIZZLE, type Database } from "@/database/database.constants.js";

constructor(@Inject(DRIZZLE) private readonly db: Database) {}
```

### Where things live

| Path                                 | What                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| `src/modules/<feature>/*.schema.ts`  | Drizzle tables, next to the feature that owns them                    |
| `src/database/schema.ts`             | Re-exports every table (used by the app and by drizzle-kit)           |
| `src/database/database.module.ts`    | Connection pool + Drizzle client, closed on shutdown                  |
| `src/database/migrate.ts`            | Production migration runner (no drizzle-kit needed)                   |
| `migrations/`                        | Generated SQL migrations + snapshots, **committed to git**            |
| `drizzle.config.ts`                  | drizzle-kit configuration                                             |

Column names are written in camelCase in TypeScript and mapped to snake_case in Postgres automatically (`casing: "snake_case"`).

### Migration workflow

1. Change or add a table in a `*.schema.ts` file (and re-export it from `src/database/schema.ts`).
2. `pnpm db:generate` creates a SQL file in `migrations/`. **Read the SQL.** On renames drizzle-kit asks whether it's a rename or a drop + create; choosing wrong loses data.
3. `pnpm db:migrate` applies it locally.
4. Commit the schema change, the SQL file and `migrations/meta/` together, and tick "Migration added" in the PR template.

Rules:

- Never edit a migration that has already been merged; write a new one.
- Migrations are forward-only (no down migrations). Undo a change with a new migration.
- For hand-written SQL or data backfills: `pnpm db:generate --custom --name=<name>`.
- Never use `drizzle-kit push` against a shared database.

### Deployed environments

Run migrations as a separate step **before** starting the new version of the app:

```bash
node dist/database/migrate.js   # included in the Docker image
```

## Health Checks

| Endpoint            | Checks                    | Use for                                                    |
| ------------------- | ------------------------- | ---------------------------------------------------------- |
| `GET /health`       | Process is up             | Liveness probe / Docker `HEALTHCHECK`                      |
| `GET /health/ready` | Database reachable (≤ 3s) | Readiness probe / load balancer target health              |

Liveness deliberately doesn't check the database, so a database outage doesn't make the platform restart every container. Readiness returns `503` while the database is unreachable.

## Docker

### Local database

```bash
docker compose up -d          # start Postgres (localhost:5433)
docker compose stop           # stop it (data is kept)
docker compose down -v        # remove it and delete all data
```

It's mapped to port **5433** so it doesn't clash with a Postgres already installed on your machine. Change it with `POSTGRES_PORT` (and update `DATABASE_URL`).

### Production image

The [`Dockerfile`](Dockerfile) builds a multi-stage image: dependencies → build → a minimal runtime with production dependencies only. It runs as a non-root user, sets `NODE_ENV=production` (so `/docs` is disabled), and has a `HEALTHCHECK` on `/health`.

```bash
docker build -t seat-lock .
```

To run the full production setup locally (Postgres → migrations → app):

```bash
docker compose --profile app up --build   # app on http://localhost:3000
docker compose --profile app down
```

When deploying, provide `DATABASE_URL` (and any other variables) from the platform's secrets, and run `node dist/database/migrate.js` with the same image as a one-off task before the new app version starts.

## API Docs

The OpenAPI spec is generated from controllers and DTOs by `@nestjs/swagger` and rendered with [Scalar](https://scalar.com).

| URL                                  | What                                                   |
| ------------------------------------ | ------------------------------------------------------ |
| http://localhost:3000/docs           | Interactive API reference (Scalar)                     |
| http://localhost:3000/openapi.json   | Raw OpenAPI document (for Postman, client generation)  |

Docs are enabled in every environment **except** `NODE_ENV=production`. Setup lives in [`src/common/docs/api-docs.ts`](src/common/docs/api-docs.ts).

When adding endpoints, document them with `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`, `@ApiConflictResponse`, …) so the docs stay accurate.

## Scripts

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `pnpm start:dev`    | Start in watch mode                        |
| `pnpm start:debug`  | Start in watch mode with debugger attached |
| `pnpm build`        | Compile to `dist/`                         |
| `pnpm start:prod`   | Run the compiled build                     |
| `pnpm lint`         | Lint `src/` and `test/` with oxlint        |
| `pnpm format`       | Format all files with Prettier             |
| `pnpm format:check` | Check formatting without writing           |
| `pnpm typecheck`    | Type-check with `tsc --noEmit`             |
| `pnpm test`         | Run unit tests                             |
| `pnpm test:watch`   | Run unit tests in watch mode               |
| `pnpm test:cov`     | Run unit tests with coverage               |
| `pnpm test:e2e`     | Run end-to-end tests (Postgres must be running) |
| `pnpm db:generate`  | Generate a SQL migration from schema changes |
| `pnpm db:migrate`   | Apply pending migrations (drizzle-kit)     |
| `pnpm db:migrate:prod` | Apply migrations from the compiled build (no drizzle-kit) |
| `pnpm db:studio`    | Open Drizzle Studio to browse the database |
| `pnpm commit`       | Create a commit with the Commitizen prompt |

## Code Quality

These checks run automatically through Git hooks:

| Hook         | What it runs                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged`: oxlint `--fix` + Prettier on staged `.ts` files, Prettier on `json`/`md`/`yml` |
| `commit-msg` | `commitlint`: rejects messages that don't follow Conventional Commits                         |

Hooks only check staged files. Before opening a PR, run the full set locally:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build
```

> Do not bypass the hooks with `--no-verify`.

## Branching Strategy

Work flows through three long-lived environment branches:

```
feat/*  ─┐
fix/*   ─┤
chore/* ─┼──► dev ──► staging ──► prod
...     ─┘
```

| Branch    | Purpose                                       | Accepts PRs from     |
| --------- | --------------------------------------------- | -------------------- |
| `dev`     | Integration branch; all work lands here first | Short-lived branches |
| `staging` | Pre-release testing / QA                      | `dev`                |
| `prod`    | Production; always deployable                 | `staging`            |

**Rules**

- `dev`, `staging` and `prod` are **protected**. Direct pushes are blocked, and every change goes through a pull request.
- Always branch off the latest `dev`:

  ```bash
  git switch dev
  git pull
  git switch -c feat/seat-hold-timer
  ```

- Open your PR into `dev`. After it's merged, delete your branch.
- Promote by opening PRs **`dev → staging`**, then **`staging → prod`**. Never skip a stage.
- Keep your branch up to date with `dev` (`git pull --rebase origin dev`) before opening or updating a PR.

## Branch Naming

Format:

```
<type>/<short-description>
```

- `type` is one of the types below; it matches the commit type of the work.
- `short-description` is lowercase kebab-case, 2–5 words.
- Optionally prefix the description with a ticket ID: `feat/SL-42-seat-hold-timer`.

| Type        | Use for                              | Example                    |
| ----------- | ------------------------------------ | -------------------------- |
| `feat/`     | New feature                          | `feat/seat-hold-timer`     |
| `fix/`      | Bug fix                              | `fix/double-booking-race`  |
| `chore/`    | Tooling, config, dependencies        | `chore/project-setup`      |
| `refactor/` | Code change with no behaviour change | `refactor/booking-service` |
| `docs/`     | Documentation only                   | `docs/branching-guide`     |
| `test/`     | Adding or fixing tests               | `test/lock-expiry-e2e`     |
| `perf/`     | Performance improvement              | `perf/seat-query-index`    |

Avoid: `Feature/SeatTimer`, `ashutosh-changes`, `fix`, `new_branch`.

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org). commitlint enforces the format on every commit.

### Format

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

- **type**: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build`, `ci`, `revert`
- **scope**: the module or area affected, e.g. `booking`, `auth`, `deps`
- **subject**: imperative mood, lowercase, no trailing period, header ≤ 100 characters
  - ✅ `add seat hold expiry`
  - ❌ `Added seat hold expiry.`

### Examples

```
feat(booking): add 10-minute seat hold expiry
fix(lock): release lock when payment fails
chore(deps): bump @nestjs/core to 12.0.2
refactor(seat): extract availability check into service
docs: add branching strategy to readme
test(booking): cover concurrent lock requests
```

Breaking change:

```
feat(api)!: rename /seats/lock to /seats/hold

BREAKING CHANGE: clients must call /seats/hold instead of /seats/lock.
```

### Using Commitizen (recommended)

Instead of `git commit -m`, use the interactive prompt:

```bash
git add <files>
pnpm commit
```

It walks you through:

1. **Type** of change (`feat`, `fix`, ...)
2. **Scope** (optional, e.g. `booking`)
3. **Short description** (the subject)
4. **Longer description** (optional body)
5. **Breaking changes?**
6. **Issues affected?** (e.g. `Closes #12`)

Commitizen builds a valid message, then the hooks run as usual. `git commit -m "..."` still works, but commitlint rejects the commit if the message is not in the format above.

### Good practices

- One logical change per commit; don't mix a refactor with a feature.
- Commit small and often.
- Use the body to explain **why**, not what. The diff already shows what.
- Reference issues in the footer: `Closes #12`.

## Pull Requests

1. Push your branch and open a PR into `dev`. The [PR template](.github/pull_request_template.md) loads automatically; fill it in.
2. Give the PR a title in commit format, e.g. `feat(booking): add seat hold expiry`.
3. Make sure lint, format, typecheck, tests and build all pass locally.
4. Get at least one approval before merging.
5. Merge, then delete the branch.

## License

[MIT](LICENSE)
