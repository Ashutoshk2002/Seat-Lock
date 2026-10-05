/**
 * Single entry point for every Drizzle table, used by both the app
 * (typed `db.query.*`) and drizzle-kit (migration generation).
 *
 * Tables live next to their feature, e.g. `src/modules/seats/seats.schema.ts`,
 * and are re-exported here:
 *
 *   export * from "../modules/seats/seats.schema.js";
 */
export {};
