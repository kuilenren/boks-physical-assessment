import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import {
  devLoginRequestSchema,
  refreshSessionRequestSchema,
  phoneLoginRequestSchema,
  phoneRequestCodeSchema,
  wechatBindingRequestSchema,
  wechatLoginRequestSchema,
} from "@boks/contracts";
import {
  createSession,
  guardianContext,
  loginWithWechat,
  loginWithPhone,
  requestPhoneCode,
  refreshSession,
  revokeSession,
  adminReviewer,
} from "./auth.js";
import { familyExists, persistStore, store } from "./demo-store.js";
import { success } from "./http.js";
import { parseInput } from "./validation.js";
import { isDevAuthEnabled } from "./runtime-config.js";
import { isPostgresStorage, persistIdentityBinding } from "./storage.js";

@Controller("auth")
export class AuthController {
  @Post("wechat-login")
  async wechatLogin(@Body() body: unknown, @Req() request: Request) {
    const input = parseInput(wechatLoginRequestSchema, body);
    return success(
      await loginWithWechat(input.code),
      request.headers["x-trace-id"] as string | undefined,
    );
  }

  @Post("wechat-bind")
  async bindWechat(@Body() body: unknown, @Req() request: Request) {
    const actor = adminReviewer(request);
    const input = parseInput(wechatBindingRequestSchema, body);
    if (!familyExists(input.family_id))
      throw new ForbiddenException({
        error: {
          code: "FAMILY_NOT_FOUND",
          message: "只能绑定到已存在的 BOKS 家庭。",
          details: [],
          retryable: false,
        },
      });
    const binding = {
      provider: "wechat" as const,
      subject: input.openid,
      guardian_id: input.guardian_id,
      family_id: input.family_id,
      created_at: new Date().toISOString(),
    };
    store.identityBindings[`wechat:${input.openid}`] = binding;
    store.auditEvents.push({
      id: randomUUID(),
      action: "auth.wechat_bind",
      actor,
      created_at: new Date().toISOString(),
    });
    if (isPostgresStorage()) {
      await persistIdentityBinding(binding);
    } else {
      await persistStore();
    }
    return success({ status: "bound" as const });
  }

  @Post("phone/request-code")
  async requestCode(@Body() body: unknown) {
    const input = parseInput(phoneRequestCodeSchema, body);
    await requestPhoneCode(input.phone);
    return success({ status: "sent" as const });
  }

  @Post("phone/login")
  async phoneLogin(@Body() body: unknown, @Req() request: Request) {
    const input = parseInput(phoneLoginRequestSchema, body);
    return success(
      await loginWithPhone(input.phone, input.code),
      request.headers["x-trace-id"] as string | undefined,
    );
  }

  @Post("dev-login")
  devLogin(@Body() body: unknown, @Req() request: Request) {
    if (!isDevAuthEnabled())
      throw new ForbiddenException({
        error: {
          code: "DEV_AUTH_DISABLED",
          message: "开发登录已关闭，请使用正式监护人登录。",
          details: [],
          retryable: false,
        },
      });
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

  @Post("refresh")
  refresh(@Body() body: unknown, @Req() request: Request) {
    const input = parseInput(refreshSessionRequestSchema, body);
    return success(
      refreshSession(input.refresh_token),
      request.headers["x-trace-id"] as string | undefined,
    );
  }

  @Post("logout")
  logout(@Req() request: Request) {
    revokeSession(request);
    return success(
      { status: "signed_out" as const },
      request.headers["x-trace-id"] as string | undefined,
    );
  }
}
