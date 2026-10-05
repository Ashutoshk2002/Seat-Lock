import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Env } from "../config/env.validation.js";
import { DRIZZLE, PG_POOL } from "./database.constants.js";
import * as schema from "./schema.js";

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const pool = new Pool({
          connectionString: config.get("DATABASE_URL", { infer: true }),
          max: config.get("DB_POOL_MAX", { infer: true }),
        });

        // An idle client erroring (e.g. DB restart) must not crash the process.
        pool.on("error", (err) =>
          new Logger("Database").error(`Idle client error: ${err.message}`)
        );

        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) =>
        drizzle(pool, { schema, casing: "snake_case" }),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
