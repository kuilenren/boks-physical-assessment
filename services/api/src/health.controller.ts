import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@boks/contracts";
import { createRequire } from "node:module";
import { checkStorageHealth } from "./storage.js";

const resolveFromApi = createRequire(__filename);
const API_VERSION: string =
  resolveFromApi("../package.json").version ?? "0.0.0";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "boks-api",
      status: "ok",
      version: API_VERSION,
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
      version: API_VERSION,
      storage,
    };
  }
}
