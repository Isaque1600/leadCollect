import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@olc/types";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: "ok" };
  }
}
