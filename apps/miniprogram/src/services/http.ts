import Taro from "@tarojs/taro";

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
  };
  message?: string | string[];
  code?: string;
  meta?: {
    trace_id?: string;
  };
}

const API_BASE_URL =
  process.env.TARO_APP_API_BASE_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://api.example.invalid/v1"
    : "http://127.0.0.1:3000/v1");
const AUTH_TOKEN_KEY = "boks.guardian.token";
let authPromise: Promise<void> | null = null;

export class ApiRequestError extends Error {
  readonly code: string;
  readonly traceId?: string;

  constructor(error: { code: string; message: string; traceId?: string }) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.traceId = error.traceId;
  }
}

export async function request<T>(
  path: string,
  options: {
    data?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    retryAuth?: boolean;
  } = {},
): Promise<T> {
  if (path !== "/auth/dev-login") {
    await ensureAuth();
  }

  const token = Taro.getStorageSync<string>(AUTH_TOKEN_KEY);
  const response = await Taro.request<ApiSuccess<T> | ApiFailure>({
    url: `${API_BASE_URL}${path}`,
    method: options.method ?? "GET",
    data: options.data,
    header: {
      "Content-Type": "application/json",
      "X-Client-Platform": "miniprogram",
      "X-Client-Version": "0.2.0",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = response.data;
  if (
    response.statusCode < 200 ||
    response.statusCode >= 300 ||
    !("data" in body)
  ) {
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
    });
    if (
      options.retryAuth !== false &&
      path !== "/auth/dev-login" &&
      (error.code === "AUTH_REQUIRED" || error.code === "AUTH_INVALID_TOKEN")
    ) {
      Taro.removeStorageSync(AUTH_TOKEN_KEY);
      await ensureAuth(true);
      return request<T>(path, { ...options, retryAuth: false });
    }
    throw error;
  }

  return body.data;
}

async function ensureAuth(force = false): Promise<void> {
  if (!force && Taro.getStorageSync<string>(AUTH_TOKEN_KEY)) return;
  if (authPromise) return authPromise;

  const configuredToken = process.env.TARO_APP_API_TOKEN;
  if (!force && configuredToken) {
    Taro.setStorageSync(AUTH_TOKEN_KEY, configuredToken);
    return;
  }

  authPromise = Taro.request<ApiSuccess<{ token: string }> | ApiFailure>({
    url: `${API_BASE_URL}/auth/dev-login`,
    method: "POST",
    data: { guardian_id: "guardian-demo-001" },
    header: {
      "Content-Type": "application/json",
      "X-Client-Platform": "miniprogram",
      "X-Client-Version": "0.2.0",
    },
  })
    .then((response) => {
      const body = response.data;
      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        !("data" in body) ||
        typeof body.data !== "object" ||
        body.data === null ||
        typeof body.data.token !== "string"
      ) {
        throw new ApiRequestError({
          code: "AUTH_FAILED",
          message: "监护人登录失败，请稍后重试。",
        });
      }
      Taro.setStorageSync(AUTH_TOKEN_KEY, body.data.token);
    })
    .finally(() => {
      authPromise = null;
    });
  return authPromise;
}
