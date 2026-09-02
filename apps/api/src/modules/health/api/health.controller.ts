import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, type HealthCheckResult } from "@nestjs/terminus";

/**
 * Liveness only — deliberately no database indicator (ADR-0008). Render probes
 * this path on every deploy, so a database blip reporting through `/health`
 * would fail the health check and block deploys for a fault the process has not
 * actually suffered. Readiness belongs on its own endpoint if we ever need it.
 *
 * With no indicators, Terminus answers `{ status: "ok", info: {}, error: {},
 * details: {} }`, so the SPA's `HealthResponse` contract still holds.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
