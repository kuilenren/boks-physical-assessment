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

// 注意：必须直接读取 process.env.X（webpack DefinePlugin 只做字面量替换，
// 经中间变量间接读取无法在构建期注入，小程序运行时没有 process）。
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.BOKS_BUILD_TARGET === "production";
const PLACEHOLDER_HOSTS = /api\.example\.invalid|example\.com|example\.org/i;
const API_BASE_URL = (() => {
  const configured = process.env.TARO_APP_API_BASE_URL;
  if (configured && configured.startsWith("http")) {
    if (isProduction && PLACEHOLDER_HOSTS.test(configured))
      throw new Error(
        "生产构建不能使用占位 API 域名，请通过 TARO_APP_API_BASE_URL 注入真实域名。",
      );
    return configured.replace(/\/+$/, "");
  }
  if (isProduction)
    throw new Error("生产构建必须通过 TARO_APP_API_BASE_URL 配置 API 域名。");
  return "http://127.0.0.1:3000/v1";
})();
const AUTH_TOKEN_KEY = "boks.guardian.token";
const AUTH_REFRESH_TOKEN_KEY = "boks.guardian.refresh-token";
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
  if (!path.startsWith("/auth/")) await ensureAuth();

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
      !path.startsWith("/auth/") &&
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
  if (!force && !isProduction && configuredToken) {
    Taro.setStorageSync(AUTH_TOKEN_KEY, configuredToken);
    return;
  }

  authPromise = (async () => {
    const refreshToken = Taro.getStorageSync<string>(AUTH_REFRESH_TOKEN_KEY);
    if (refreshToken) {
      const refreshed = await Taro.request<
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
        Taro.setStorageSync(AUTH_TOKEN_KEY, refreshed.data.data.token);
        Taro.setStorageSync(
          AUTH_REFRESH_TOKEN_KEY,
          refreshed.data.data.refresh_token,
        );
        return;
      }
      Taro.removeStorageSync(AUTH_REFRESH_TOKEN_KEY);
    }

    const response =
      process.env.NODE_ENV === "production"
        ? await (async () => {
            const login = await Taro.login();
            return Taro.request<
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
        : await Taro.request<
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
    Taro.setStorageSync(AUTH_TOKEN_KEY, body.data.token);
    Taro.setStorageSync(AUTH_REFRESH_TOKEN_KEY, body.data.refresh_token);
  })().finally(() => {
    authPromise = null;
  });
  return authPromise;
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST", retryAuth: false });
  } finally {
    Taro.removeStorageSync(AUTH_TOKEN_KEY);
    Taro.removeStorageSync(AUTH_REFRESH_TOKEN_KEY);
  }
}
