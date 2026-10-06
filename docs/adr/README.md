# Architecture Decision Records

An ADR captures **one significant decision**: the context, the options considered, what was chosen and why, and the consequences. ADRs are never edited after acceptance. A changed decision gets a new ADR that supersedes the old one.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-drizzle-orm.md) | Drizzle ORM for PostgreSQL access and migrations | Accepted |
| [0002](0002-redis-lua-seat-holds.md) | Redis + Lua for seat holds, with a Postgres partial unique index as the final safeguard | Proposed |
| [0003](0003-redis-failure-policy.md) | Fail closed when Redis is unavailable | Proposed |

**Statuses:** Proposed → Accepted → (Superseded by NNNN | Deprecated)

New ADR: copy [`template.md`](template.md) to `NNNN-short-title.md` and add it to this table.
