import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@boks/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "boks-api",
      status: "ok",
      version: "0.1.0",
    };
  }
}
