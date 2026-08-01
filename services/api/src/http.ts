import { randomUUID } from "node:crypto";

export type ApiSuccess<T> = {
  data: T;
  meta: {
    trace_id: string;
    request_id: string;
  };
};

export function success<T>(data: T, traceId?: string): ApiSuccess<T> {
  return {
    data,
    meta: {
      trace_id: traceId ?? randomUUID(),
      request_id: randomUUID(),
    },
  };
}
