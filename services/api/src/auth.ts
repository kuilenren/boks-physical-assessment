import { randomUUID } from "node:crypto";
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  getChild,
  persistStore,
  store,
  type Consent,
  type GuardianSession,
} from "./demo-store.js";

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

export function guardianContext(request: Request): GuardianContext {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const session = store.sessions[token];
    if (session && new Date(session.expires_at).getTime() > Date.now()) {
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
  if (process.env.BOKS_ENABLE_DEV_AUTH !== "false")
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
  if (!getChild(childId))
    resourceNotFound("CHILD_NOT_FOUND", "儿童档案不存在。");
  return context;
}

export function assertResourceChild(
  request: Request,
  childId: string,
  resourceCode: string,
): GuardianContext {
  const context = assertChildAccess(request, childId);
  if (context.family_id !== store.family_id)
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
export function createSession(guardianId: string): GuardianSession {
  const session: GuardianSession = {
    token: randomUUID(),
    guardian_id: guardianId,
    family_id: store.family_id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  store.sessions[session.token] = session;
  void persistStore();
  return session;
}
