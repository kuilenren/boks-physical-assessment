import {
  getStorageSync as taroGetStorageSync,
  login as taroLogin,
  removeStorageSync as taroRemoveStorageSync,
  request as taroRequest,
  setStorageSync as taroSetStorageSync,
} from "@tarojs/taro";

interface ApiSuccess<T> {
  data: T;
  meta: {
    trace_id: string;
    request_id: string;
  };
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  message?: string | string[];
  code?: string;
  meta?: {
    trace_id?: string;
  };
}

const runtimeEnv =
  typeof process === "undefined"
    ? ({} as Record<string, string | undefined>)
    : process.env;
const isProduction =
  runtimeEnv.NODE_ENV === "production" ||
  runtimeEnv.BOKS_BUILD_TARGET === "production";
const PLACEHOLDER_HOSTS = /api\.example\.invalid|example\.com|example\.org/i;
const API_BASE_URL = (() => {
  const configured = runtimeEnv.TARO_APP_API_BASE_URL;
  if (configured && configured.startsWith("http")) {
    if (isProduction && PLACEHOLDER_HOSTS.test(configured))
      throw new Error(
        "生产构建不能使用占位 API 域名，请通过 TARO_APP_API_BASE_URL 注入真实域名。",
      );
    return configured.replace(/\/+$/, "");
  }
  if (isProduction)
    throw new Error(
      "生产构建必须通过 TARO_APP_API_BASE_URL 配置 API 域名。",
    );
  return "http://127.0.0.1:3000/v1";
})();
const AUTH_TOKEN_KEY = "boks.guardian.token";
const AUTH_REFRESH_TOKEN_KEY = "boks.guardian.refresh-token";
const REQUEST_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
let authPromise: Promise<void> | null = null;

export class ApiRequestError extends Error {
  readonly code: string;
  readonly traceId?: string;
  readonly retryable: boolean;

  constructor(error: {
    code: string;
    message: string;
    traceId?: string;
    retryable?: boolean;
  }) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.traceId = error.traceId;
    this.retryable = error.retryable ?? false;
  }
}

function buildHeaders(token?: string, idempotencyKey?: string) {
  return {
    "Content-Type": "application/json",
    "X-Client-Platform": "miniprogram",
    "X-Client-Version": "0.2.0",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

function isWriteMethod(method: string): boolean {
  return method === "POST" || method === "PATCH" || method === "DELETE";
}

async function sendRaw(
  path: string,
  options: {
    data?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
    idempotencyKey?: string;
  },
): Promise<{ statusCode: number; data: ApiSuccess<unknown> | ApiFailure }> {
  return taroRequest<ApiSuccess<unknown> | ApiFailure>({
    url: `${API_BASE_URL}${path}`,
    method: options.method ?? "GET",
    data: options.data,
    header: buildHeaders(options.token, options.idempotencyKey),
    timeout: REQUEST_TIMEOUT_MS,
  });
}

export async function request<T>(
  path: string,
  options: {
    data?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    retryAuth?: boolean;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  if (!path.startsWith("/auth/")) await ensureAuth();

  const token = taroGetStorageSync<string>(AUTH_TOKEN_KEY);
  const method = options.method ?? "GET";
  const idempotencyKey =
    options.idempotencyKey ??
    (isWriteMethod(method) ? randomIdempotencyKey() : undefined);
  const response = await sendRaw(path, {
    data: options.data,
    method,
    token,
    idempotencyKey,
  });

  const body = response.data;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const failure = body as ApiFailure;
    const message =
      failure.error?.message ??
      (Array.isArray(failure.message)
        ? failure.message.join("；")
        : failure.message) ??
      "服务端返回了无法识别的响应。";
    const error = new ApiRequestError({
      code:
        failure.error?.code ?? failure.code ?? `HTTP_${response.statusCode}`,
      message,
      traceId: failure.meta?.trace_id,
      retryable: failure.error?.retryable ?? RETRYABLE_STATUS.has(response.statusCode),
    });
    if (
      options.retryAuth !== false &&
      !path.startsWith("/auth/") &&
      (error.code === "AUTH_REQUIRED" || error.code === "AUTH_INVALID_TOKEN")
    ) {
      taroRemoveStorageSync(AUTH_TOKEN_KEY);
      await ensureAuth(true);
      return request<T>(path, { ...options, retryAuth: false });
    }
    throw error;
  }

  return (body as ApiSuccess<T>).data;
}

function randomIdempotencyKey(): string {
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}

export async function requestWithRetry<T>(
  path: string,
  options: {
    data?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    maxAttempts?: number;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(backoffDelay(attempt));
    try {
      return await request<T>(path, options);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiRequestError) || !error.retryable) throw error;
    }
  }
  throw lastError;
}

function backoffDelay(attempt: number): number {
  return Math.min(1500, 250 * 2 ** attempt) + Math.floor(Math.random() * 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAuth(force = false): Promise<void> {
  if (!force && taroGetStorageSync<string>(AUTH_TOKEN_KEY)) return;
  if (authPromise) return authPromise;

  const configuredToken = runtimeEnv.TARO_APP_API_TOKEN;
  if (!force && !isProduction && configuredToken) {
    taroSetStorageSync(AUTH_TOKEN_KEY, configuredToken);
    return;
  }

  authPromise = (async () => {
    const refreshToken = taroGetStorageSync<string>(AUTH_REFRESH_TOKEN_KEY);
    if (refreshToken) {
      const refreshed = await taroRequest<
        ApiSuccess<{ token: string; refresh_token: string }> | ApiFailure
      >({
        url: `${API_BASE_URL}/auth/refresh`,
        method: "POST",
        data: { refresh_token: refreshToken },
        header: {
          "Content-Type": "application/json",
          "X-Client-Platform": "miniprogram",
          "X-Client-Version": "0.2.0",
        },
      });
      if (
        refreshed.statusCode >= 200 &&
        refreshed.statusCode < 300 &&
        "data" in refreshed.data &&
        typeof refreshed.data.data.token === "string" &&
        typeof refreshed.data.data.refresh_token === "string"
      ) {
        taroSetStorageSync(AUTH_TOKEN_KEY, refreshed.data.data.token);
        taroSetStorageSync(
          AUTH_REFRESH_TOKEN_KEY,
          refreshed.data.data.refresh_token,
        );
        return;
      }
      taroRemoveStorageSync(AUTH_REFRESH_TOKEN_KEY);
    }

    const response =
      isProduction
        ? await (async () => {
            const login = await taroLogin();
            return taroRequest<
              ApiSuccess<{ token: string; refresh_token: string }> | ApiFailure
            >({
              url: `${API_BASE_URL}/auth/wechat-login`,
              method: "POST",
              data: { code: login.code },
              header: {
                "Content-Type": "application/json",
                "X-Client-Platform": "miniprogram",
                "X-Client-Version": "0.2.0",
              },
            });
          })()
        : await taroRequest<
            ApiSuccess<{ token: string; refresh_token: string }> | ApiFailure
          >({
            url: `${API_BASE_URL}/auth/dev-login`,
            method: "POST",
            data: { guardian_id: "guardian-demo-001" },
            header: {
              "Content-Type": "application/json",
              "X-Client-Platform": "miniprogram",
              "X-Client-Version": "0.2.0",
            },
          });
    const body = response.data;
    if (
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      !("data" in body) ||
      typeof body.data !== "object" ||
      body.data === null ||
      typeof body.data.token !== "string" ||
      typeof body.data.refresh_token !== "string"
    ) {
      const failure = body as ApiFailure;
      throw new ApiRequestError({
        code: failure.error?.code ?? "AUTH_FAILED",
        message: failure.error?.message ?? "监护人登录失败，请稍后重试。",
      });
    }
    taroSetStorageSync(AUTH_TOKEN_KEY, body.data.token);
    taroSetStorageSync(AUTH_REFRESH_TOKEN_KEY, body.data.refresh_token);
  })().finally(() => {
    authPromise = null;
  });
  return authPromise;
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST", retryAuth: false });
  } finally {
    taroRemoveStorageSync(AUTH_TOKEN_KEY);
    taroRemoveStorageSync(AUTH_REFRESH_TOKEN_KEY);
  }
}
