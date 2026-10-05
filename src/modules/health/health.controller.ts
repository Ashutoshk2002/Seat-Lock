import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database.health.js";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator
  ) {}

  /**
   * Liveness: the process is up and serving HTTP. Deliberately does not
   * check dependencies, so a database outage doesn't make the platform
   * restart every container.
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Liveness probe" })
  live() {
    return this.health.check([]);
  }

  /** Readiness: the app can serve real traffic (database reachable). */
  @Get("ready")
  @HealthCheck()
  @ApiOperation({ summary: "Readiness probe (checks database)" })
  ready() {
    return this.health.check([() => this.database.isHealthy("database")]);
  }
}
