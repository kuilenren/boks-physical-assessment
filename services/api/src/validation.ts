import { BadRequestException } from "@nestjs/common";

type SafeParseResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        issues: Array<{
          path: Array<string | number>;
          message: string;
        }>;
      };
    };

type InputSchema<T> = {
  safeParse(value: unknown): SafeParseResult<T>;
};

export function parseInput<T>(schema: InputSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      error: {
        code: "INVALID_REQUEST",
        message: "请求参数不符合要求。",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          reason: issue.message,
        })),
        retryable: false,
      },
    });
  }
  return result.data;
}
