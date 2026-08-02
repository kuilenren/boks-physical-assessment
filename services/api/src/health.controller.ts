import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@boks/contracts";
import { checkStorageHealth } from "./storage.js";

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

  @Get("ready")
  async getReadiness() {
    const storage = await checkStorageHealth();
    if (!storage.ready)
      throw new ServiceUnavailableException({
        error: {
          code: "SERVICE_NOT_READY",
          message: "服务依赖尚未就绪。",
          details: [],
          retryable: true,
        },
      });
    return {
      service: "boks-api",
      status: "ready" as const,
      version: "0.1.0",
      storage,
    };
  }
}
