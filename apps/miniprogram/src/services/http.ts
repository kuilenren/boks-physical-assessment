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
    method?: "GET" | "POST" | "PATCH";
  } = {},
): Promise<T> {
  const response = await Taro.request<ApiSuccess<T> | ApiFailure>({
    url: `${API_BASE_URL}${path}`,
    method: options.method ?? "GET",
    data: options.data,
    header: {
      "Content-Type": "application/json",
      "X-Client-Platform": "miniprogram",
      "X-Client-Version": "0.1.0",
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
    throw new ApiRequestError({
      code:
        failure.error?.code ?? failure.code ?? `HTTP_${response.statusCode}`,
      message,
      traceId: failure.meta?.trace_id,
    });
  }

  return body.data;
}
