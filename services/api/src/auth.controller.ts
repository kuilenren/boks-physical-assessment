import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { devLoginRequestSchema } from "@boks/contracts";
import { createSession, guardianContext } from "./auth.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";

@Controller("auth")
export class AuthController {
  @Post("dev-login")
  devLogin(@Body() body: unknown, @Req() request: Request) {
    if (process.env.BOKS_ENABLE_DEV_AUTH === "false")
      return {
        ...success(null),
        error: { code: "DEV_AUTH_DISABLED", message: "开发登录已关闭。" },
      };
    const input = parseInput(devLoginRequestSchema, body ?? {});
    return success(
      createSession(input.guardian_id),
      request.headers["x-trace-id"] as string | undefined,
    );
  }
  @Get("session")
  session(@Req() request: Request) {
    return success(
      guardianContext(request),
      request.headers["x-trace-id"] as string | undefined,
    );
  }
}
