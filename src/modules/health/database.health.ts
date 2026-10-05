import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import { DRIZZLE, type Database } from "@/database/database.constants.js";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicator: HealthIndicatorService,
    @Inject(DRIZZLE) private readonly db: Database
  ) {}

  isHealthy<const Key extends string>(key: Key) {
    return this.healthIndicator
      .check(key)
      .attempt(async () => {
        await this.db.execute(sql`select 1`);
      })
      .withTimeout(3000);
  }
}
