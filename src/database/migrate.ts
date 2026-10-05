/**
 * Applies pending SQL migrations from `migrations/` using drizzle-orm only,
 * so it runs in the production image where drizzle-kit (a devDependency)
 * is not installed.
 *
 *   node dist/database/migrate.js
 *
 * Run it as a deploy step before starting the app, not on app boot.
 */
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { envSchema } from "../config/env.validation.js";

const { DATABASE_URL } = envSchema
  .pick({ DATABASE_URL: true })
  .parse(process.env);

// dist/database/migrate.js -> <project root>/migrations
const migrationsFolder = fileURLToPath(
  new URL("../../migrations", import.meta.url)
);

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log("Migrations applied");
} finally {
  await pool.end();
}
