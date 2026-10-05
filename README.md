# Seat Lock

Backend service for Seat Lock, built with [NestJS](https://nestjs.com).

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
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
| Testing         | Vitest + Supertest                                                                                                  |
| Linting         | [oxlint](https://oxc.rs) (type-aware)                                                                               |
| Formatting      | Prettier                                                                                                            |
| Git hooks       | Husky + lint-staged                                                                                                 |
| Commits         | [Commitizen](https://github.com/commitizen/cz-cli) + [commitlint](https://commitlint.js.org) (Conventional Commits) |

## Prerequisites

- **Node.js 24+**: the version is pinned in `.nvmrc`, so run `nvm use` in the project folder.
- **pnpm 10**: run `corepack enable` once; Corepack then uses the version pinned in `package.json`.

## Getting Started

```bash
git clone https://github.com/Ashutoshk2002/Seat-Lock.git
cd Seat-Lock
nvm use
pnpm install        # also installs the Husky git hooks
cp .env.example .env
pnpm start:dev      # http://localhost:3000
```

### Environment Variables

All variables are documented in [`.env.example`](.env.example). Copy it to `.env` and adjust the values locally. `.env` is git-ignored and must never be committed.

| Variable   | Default       | Description                                           |
| ---------- | ------------- | ----------------------------------------------------- |
| `NODE_ENV` | `development` | One of `development`, `test`, `staging`, `production` |
| `PORT`     | `3000`        | Port the HTTP server listens on                       |

`.env` is loaded at startup by `@nestjs/config` and validated with zod in [`src/config/env.validation.ts`](src/config/env.validation.ts). If a value is missing or invalid, the app refuses to start and prints which variable is wrong. Real environment variables take precedence over `.env`.

Read config through the typed `ConfigService` instead of `process.env`:

```ts
constructor(private readonly config: ConfigService<Env, true>) {}

const port = this.config.get('PORT', { infer: true }); // number
```

**Adding a new variable:** add it to the schema in `env.validation.ts`, to `.env.example`, and to this table, all in the same PR.

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
| `pnpm test:e2e`     | Run end-to-end tests                       |
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
