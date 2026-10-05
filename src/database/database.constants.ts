import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema.js";

/** Injection token for the Drizzle client: `@Inject(DRIZZLE) db: Database` */
export const DRIZZLE = Symbol("DRIZZLE");

/** Injection token for the underlying `pg` connection pool. */
export const PG_POOL = Symbol("PG_POOL");

export type Database = NodePgDatabase<typeof schema>;
