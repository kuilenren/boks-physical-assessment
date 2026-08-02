import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  getChild,
  loadFamilyStore,
  persistStore,
  store,
  familyExists,
  type Consent,
  type GuardianSession,
} from "./demo-store.js";
import { isDevAuthEnabled } from "./runtime-config.js";
import {
  registerAuthHydrator,
  isPostgresStorage,
  persistAuthSession,
  revokePersistedSession,
  type PersistedAuthState,
} from "./storage.js";

export type GuardianContext = {
  guardian_id: string;
  family_id: string;
  token: string | null;
};

type StableError = {
  error: {
    code: string;
    message: string;
    details: Array<Record<string, string>>;
    retryable: boolean;
  };
};

type PersistedSession = PersistedAuthState["sessions"][number];
type PersistedBinding = PersistedAuthState["identity_bindings"][number];
const persistedSessions = new Map<string, PersistedSession>();
const persistedBindings = new Map<string, PersistedBinding>();

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(normalized))
    throw new Error("BOKS_ADMIN_MFA_SECRET 不是合法的 Base32 密钥。");
  let bits = "";
  for (const character of normalized) {
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(character)
      .toString(2)
      .padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8)
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function expectedTotpCodes(secret: string, now = Date.now()): string[] {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1]
    .filter((offset) => counter + offset >= 0)
    .map((offset) => {
      const message = Buffer.alloc(8);
      message.writeBigUInt64BE(BigInt(counter + offset));
      const digest = createHmac("sha1", key).update(message).digest();
      const position = digest[digest.length - 1] & 0x0f;
      const binary =
        ((digest[position] & 0x7f) << 24) |
        ((digest[position + 1] & 0xff) << 16) |
        ((digest[position + 2] & 0xff) << 8) |
        (digest[position + 3] & 0xff);
      return String(binary % 1_000_000).padStart(6, "0");
    });
}

function assertAdminMfa(request: Request): void {
  const secret = process.env.BOKS_ADMIN_MFA_SECRET?.trim();
  if (!secret) {
    if (isDevAuthEnabled()) return;
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_MFA_NOT_CONFIGURED",
        message: "内部管理员多因素认证尚未配置。",
        details: [],
        retryable: false,
      },
    });
  }
  const code = headerValue(request, "x-admin-mfa");
  if (!code || !/^\d{6}$/.test(code))
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_MFA_REQUIRED",
        message: "需要有效的内部管理员动态验证码。",
        details: [],
        retryable: false,
      },
    });
  if (
    !expectedTotpCodes(secret).some((expected) =>
      constantTimeEqual(code, expected),
    )
  )
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_MFA_INVALID",
        message: "内部管理员动态验证码无效或已过期。",
        details: [],
        retryable: false,
      },
    });
}

function hydratePersistedAuthState(state: PersistedAuthState): void {
  persistedSessions.clear();
  for (const session of state.sessions)
    persistedSessions.set(session.access_token_hash, session);
  persistedBindings.clear();
  for (const binding of state.identity_bindings)
    persistedBindings.set(
      `${binding.provider}:${binding.subject_hash}`,
      binding,
    );
}

registerAuthHydrator(hydratePersistedAuthState);

export function resourceNotFound(code: string, message: string): never {
  throw new NotFoundException({
    error: { code, message, details: [], retryable: false },
  } satisfies StableError);
}

export function resourceForbidden(code: string, message: string): never {
  throw new ForbiddenException({
    error: { code, message, details: [], retryable: false },
  } satisfies StableError);
}

export function isValidSessionToken(token: string): boolean {
  const session =
    store.sessions[token] ?? persistedSessions.get(hashSecret(token));
  return Boolean(
    session &&
    session.revoked_at === null &&
    new Date(session.expires_at).getTime() > Date.now(),
  );
}

export function guardianContext(request: Request): GuardianContext {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const session =
      store.sessions[token] ?? persistedSessions.get(hashSecret(token));
    if (
      session &&
      session.revoked_at === null &&
      new Date(session.expires_at).getTime() > Date.now()
    ) {
      return {
        guardian_id: session.guardian_id,
        family_id: session.family_id,
        token,
      };
    }
    throw new UnauthorizedException({
      error: {
        code: "AUTH_INVALID_TOKEN",
        message: "登录已失效，请重新登录。",
        details: [],
        retryable: false,
      },
    });
  }
  if (isDevAuthEnabled())
    return {
      guardian_id: "guardian-demo-001",
      family_id: store.family_id,
      token: null,
    };
  throw new UnauthorizedException({
    error: {
      code: "AUTH_REQUIRED",
      message: "需要监护人登录。",
      details: [],
      retryable: false,
    },
  });
}

export function assertChildAccess(
  request: Request,
  childId: string,
): GuardianContext {
  const context = guardianContext(request);
  if (!getChild(childId, context.family_id))
    resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
  return context;
}

export async function assertChildAccessAsync(
  request: Request,
  childId: string,
): Promise<GuardianContext> {
  const context = guardianContext(request);
  const family = await loadFamilyStore(context.family_id);
  if (
    !family.children.some(
      (child) => child.id === childId && child.profile_status === "active",
    )
  )
    resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
  return context;
}

export function assertResourceChild(
  request: Request,
  childId: string,
  resourceCode: string,
): GuardianContext {
  const context = assertChildAccess(request, childId);
  if (!familyExists(context.family_id))
    resourceForbidden(resourceCode, "资源不属于当前家庭。");
  return context;
}
export function hasConsent(
  context: GuardianContext,
  childId: string,
  purpose: Consent["purpose"],
): boolean {
  return Object.values(store.consents).some(
    (consent) =>
      consent.family_id === context.family_id &&
      consent.child_id === childId &&
      consent.purpose === purpose &&
      consent.granted &&
      consent.withdrawn_at === null,
  );
}
export function requireConsent(
  request: Request,
  childId: string,
  purpose: Consent["purpose"],
): GuardianContext {
  const context = assertChildAccess(request, childId);
  if (!hasConsent(context, childId, purpose))
    throw new ForbiddenException({
      error: {
        code: "CONSENT_REQUIRED",
        message: `需要先同意${purpose}用途后才能继续。`,
        details: [],
        retryable: false,
      },
    });
  return context;
}

export function requireConsentRecord(
  request: Request,
  recordId: string,
  childId: string,
  purpose: Consent["purpose"],
): GuardianContext {
  const context = assertChildAccess(request, childId);
  const consent = store.consents[recordId];
  if (
    !consent ||
    consent.family_id !== context.family_id ||
    consent.child_id !== childId ||
    consent.purpose !== purpose ||
    !consent.granted ||
    consent.withdrawn_at !== null
  )
    resourceForbidden(
      "CONSENT_REQUIRED",
      "需要当前家庭对该儿童的有效照片同意记录。",
    );
  return context;
}
export function createSession(
  guardianId: string,
  familyId = store.family_id,
): GuardianSession {
  if (!familyExists(familyId))
    throw new ForbiddenException({
      error: {
        code: "FAMILY_NOT_FOUND",
        message: "BOKS 家庭不存在或已停用。",
        details: [],
        retryable: false,
      },
    });
  const session: GuardianSession = {
    token: randomUUID(),
    refresh_token: randomUUID(),
    guardian_id: guardianId,
    family_id: familyId,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    revoked_at: null,
  };
  store.sessions[session.token] = session;
  if (isPostgresStorage()) {
    void persistAuthSession(session);
  } else {
    void persistStore();
  }
  return session;
}

export async function loginWithWechat(code: string): Promise<GuardianSession> {
  const appId = process.env.BOKS_WECHAT_APP_ID;
  const appSecret = process.env.BOKS_WECHAT_APP_SECRET;
  if (!appId || !appSecret)
    throw new ServiceUnavailableException({
      error: {
        code: "WECHAT_AUTH_NOT_CONFIGURED",
        message: "微信登录服务尚未完成生产配置。",
        details: [],
        retryable: false,
      },
    });
  const response = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(
      appId,
    )}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(
      code,
    )}&grant_type=authorization_code`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok)
    throw new ServiceUnavailableException({
      error: {
        code: "WECHAT_AUTH_UNAVAILABLE",
        message: "微信登录服务暂时不可用，请稍后重试。",
        details: [],
        retryable: true,
      },
    });
  const payload = (await response.json()) as {
    openid?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (!payload.openid || payload.errcode)
    throw new UnauthorizedException({
      error: {
        code: "WECHAT_AUTH_FAILED",
        message: payload.errmsg ?? "微信登录凭证无效。",
        details: [],
        retryable: false,
      },
    });
  const binding =
    store.identityBindings[`wechat:${payload.openid}`] ??
    persistedBindings.get(`wechat:${hashSecret(payload.openid)}`);
  if (!binding)
    throw new ForbiddenException({
      error: {
        code: "FAMILY_BINDING_REQUIRED",
        message: "该微信账号尚未绑定 BOKS 家庭，请联系 BOKS 完成绑定。",
        details: [],
        retryable: false,
      },
    });
  return createSession(binding.guardian_id, binding.family_id);
}

async function phoneProviderRequest(
  path: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const providerUrl = process.env.BOKS_PHONE_AUTH_URL;
  const providerToken = process.env.BOKS_PHONE_AUTH_TOKEN;
  if (!providerUrl || !providerToken)
    throw new ServiceUnavailableException({
      error: {
        code: "PHONE_AUTH_NOT_CONFIGURED",
        message: "手机号登录服务尚未完成生产配置。",
        details: [],
        retryable: false,
      },
    });
  const response = await fetch(`${providerUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new UnauthorizedException({
      error: {
        code: "PHONE_AUTH_FAILED",
        message:
          typeof payload.message === "string"
            ? payload.message
            : "手机号登录服务拒绝了请求。",
        details: [],
        retryable: response.status >= 500,
      },
    });
  return payload;
}

export async function requestPhoneCode(phone: string): Promise<void> {
  await phoneProviderRequest("/request-code", { phone });
}

export async function loginWithPhone(
  phone: string,
  code: string,
): Promise<GuardianSession> {
  const payload = await phoneProviderRequest("/verify", { phone, code });
  const guardianId = payload.guardian_id;
  const familyId = payload.family_id;
  if (
    typeof guardianId !== "string" ||
    typeof familyId !== "string" ||
    !familyExists(familyId)
  )
    throw new ForbiddenException({
      error: {
        code: "FAMILY_BINDING_REQUIRED",
        message: "该手机号尚未绑定 BOKS 家庭，请联系 BOKS 完成绑定。",
        details: [],
        retryable: false,
      },
    });
  return createSession(guardianId, familyId);
}

export function refreshSession(refreshToken: string): GuardianSession {
  const existing =
    Object.values(store.sessions).find(
      (session) =>
        session.refresh_token === refreshToken &&
        session.revoked_at === null &&
        new Date(session.refresh_expires_at).getTime() > Date.now(),
    ) ??
    [...persistedSessions.values()].find(
      (session) =>
        session.refresh_token_hash === hashSecret(refreshToken) &&
        session.revoked_at === null &&
        new Date(session.refresh_expires_at).getTime() > Date.now(),
    );
  if (!existing)
    throw new UnauthorizedException({
      error: {
        code: "AUTH_INVALID_REFRESH_TOKEN",
        message: "刷新令牌无效或已过期，请重新登录。",
        details: [],
        retryable: false,
      },
    });
  existing.revoked_at = new Date().toISOString();
  if ("access_token_hash" in existing) {
    void revokePersistedSession(existing.access_token_hash);
  } else if (isPostgresStorage()) {
    void revokePersistedSession(hashSecret(existing.token));
  } else {
    void persistStore();
  }
  return createSession(existing.guardian_id, existing.family_id);
}

export function revokeSession(request: Request): void {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return;
  const token = header.slice(7);
  const session = store.sessions[token];
  if (session) {
    session.revoked_at = new Date().toISOString();
    if (isPostgresStorage()) {
      void revokePersistedSession(hashSecret(token));
    } else {
      void persistStore();
    }
    return;
  }
  const persisted = persistedSessions.get(hashSecret(token));
  if (persisted) {
    persisted.revoked_at = new Date().toISOString();
    void revokePersistedSession(persisted.access_token_hash);
  }
}

export function adminReviewer(request: Request): string {
  const configured = process.env.BOKS_ADMIN_TOKEN;
  const token = headerValue(request, "x-admin-token");
  const expected =
    configured ?? (isDevAuthEnabled() ? "dev-admin-token" : undefined);
  if (!expected || !token || !constantTimeEqual(token, expected))
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_TOKEN_REQUIRED",
        message: "需要有效的 BOKS 内部管理员认证。",
        details: [],
        retryable: false,
      },
    });
  assertAdminMfa(request);
  const reviewer = headerValue(request, "x-admin-reviewer");
  const allowlist = (process.env.BOKS_ADMIN_REVIEWERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!reviewer && !isDevAuthEnabled())
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_REVIEWER_REQUIRED",
        message: "需要明确的内部审核员身份。",
        details: [],
        retryable: false,
      },
    });
  if (allowlist.length > 0 && (!reviewer || !allowlist.includes(reviewer)))
    throw new UnauthorizedException({
      error: {
        code: "ADMIN_REVIEWER_NOT_ALLOWED",
        message: "当前审核员不在 BOKS 内部审核员白名单中。",
        details: [],
        retryable: false,
      },
    });
  return reviewer ?? token;
}
