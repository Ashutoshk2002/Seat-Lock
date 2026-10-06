# 0001. Drizzle ORM for PostgreSQL access and migrations

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

SeatLock's correctness depends on database features that ORMs often hide: row locks (`SELECT … FOR UPDATE`, `SKIP LOCKED`), atomic conditional updates (`UPDATE … WHERE status = … RETURNING`), and partial unique indexes. The project is ESM on `nodenext` with TypeScript 6. Decorator-based entities with circular relations are fragile in that setup.

## Options considered

1. **Prisma**: excellent DX and schema tooling. Its query API lacks `FOR UPDATE`, so the concurrency-critical code would end up in untyped `$queryRaw`.
2. **TypeORM**: official Nest integration and supports pessimistic locks. Slow maintenance, weak query typing, and ESM/decorator problems.
3. **Sequelize**: weak TypeScript support.
4. **MikroORM**: a solid unit-of-work ORM with lock modes. Heavier than we need.
5. **Kysely**: an excellent typed query builder, but no migration or schema tooling out of the box.
6. **Drizzle ORM**: SQL-first and typed, including `.for("update", { skipLocked: true })`, partial indexes and raw `sql`. drizzle-kit generates reviewable SQL migrations. Native ESM with no codegen.

## Decision

Use **Drizzle ORM 0.45 (stable) with drizzle-kit**. Tables live next to their feature module, relations are defined centrally, and migrations are SQL files committed to the repo. Production applies them with `drizzle-orm`'s migrator, so drizzle-kit isn't needed at runtime.

## Consequences

- Concurrency-critical queries stay typed and readable.
- No official Nest module, so we maintain a small `DatabaseModule` provider.
- drizzle-kit migrations are forward-only, and renames are interactive and error-prone. Mitigated by the review rules in `CLAUDE.md` and the README.
- The v1 APIs (e.g. `defineRelations`) aren't available until we upgrade.
