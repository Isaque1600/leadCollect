import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  /** Liveness probe: answers 200 while the process is up. */
  // Terminus's own OpenAPI entry shows a `database` indicator in its example and
  // a 503, and neither can happen here. `swaggerDocumentation: false` drops it,
  // and `@ApiOkResponse` documents the body this route actually sends.
  // `noCache` is Terminus's default; passing an options object replaces the
  // defaults, so it has to be restated.
  @Get()
  @HealthCheck({ noCache: true, swaggerDocumentation: false })
  @ApiOkResponse({
    description: "The process is up.",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ok"] },
        info: { type: "object" },
        error: { type: "object" },
        details: { type: "object" },
      },
      example: { status: "ok", info: {}, error: {}, details: {} },
    },
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
