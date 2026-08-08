import { isIP } from "node:net";

export type RuntimeEnvironment =
  "development" | "test" | "staging" | "production";

function configuredEnvironment(): RuntimeEnvironment {
  const value =
    process.env.BOKS_RUNTIME_ENV ?? process.env.NODE_ENV ?? "development";
  if (
    value === "development" ||
    value === "test" ||
    value === "staging" ||
    value === "production"
  )
    return value;
  throw new Error(`不支持的运行环境：${value}`);
}

export function runtimeEnvironment(): RuntimeEnvironment {
  return configuredEnvironment();
}

export function isProductionRuntime(): boolean {
  return configuredEnvironment() === "production";
}

export function isDevAuthEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return process.env.BOKS_ENABLE_DEV_AUTH !== "false";
}

function requiredProduction(name: string, value: string | undefined): string[] {
  return value && value.trim().length > 0 ? [] : [`缺少生产配置 ${name}`];
}

export function assertRuntimeConfig(): void {
  const errors: string[] = [];
  if (isProductionRuntime()) {
    errors.push(
      ...requiredProduction("BOKS_DATABASE_URL", process.env.BOKS_DATABASE_URL),
    );
    errors.push(
      ...requiredProduction("BOKS_ADMIN_TOKEN", process.env.BOKS_ADMIN_TOKEN),
    );
    if (process.env.BOKS_ADMIN_TOKEN === "replace-me")
      errors.push(
        "生产环境不能使用 .env.example 中的 BOKS_ADMIN_TOKEN 占位值。",
      );
    errors.push(
      ...requiredProduction(
        "BOKS_ADMIN_REVIEWERS",
        process.env.BOKS_ADMIN_REVIEWERS,
      ),
    );
    errors.push(
      ...requiredProduction(
        "BOKS_ADMIN_MFA_SECRET",
        process.env.BOKS_ADMIN_MFA_SECRET,
      ),
    );
    const adminReviewers = (process.env.BOKS_ADMIN_REVIEWERS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (new Set(adminReviewers).size < 2)
      errors.push("生产环境 BOKS_ADMIN_REVIEWERS 必须至少配置两名不同审核员。");
    const adminMfaSecret = (process.env.BOKS_ADMIN_MFA_SECRET ?? "")
      .replace(/[\s=-]/g, "")
      .toUpperCase();
    if (
      adminMfaSecret &&
      (!/^[A-Z2-7]+$/.test(adminMfaSecret) || adminMfaSecret.length < 16)
    )
      errors.push(
        "生产环境 BOKS_ADMIN_MFA_SECRET 必须是至少 16 位的 Base32 密钥。",
      );
    if (adminMfaSecret === "JBSWY3DPEHPK3PXP")
      errors.push(
        "生产环境不能使用 .env.example 中的 BOKS_ADMIN_MFA_SECRET 示例值。",
      );
    errors.push(
      ...requiredProduction(
        "BOKS_OBJECT_STORAGE_BUCKET",
        process.env.BOKS_OBJECT_STORAGE_BUCKET,
      ),
    );
    errors.push(
      ...requiredProduction(
        "BOKS_OBJECT_STORAGE_ACCESS_KEY",
        process.env.BOKS_OBJECT_STORAGE_ACCESS_KEY,
      ),
    );
    errors.push(
      ...requiredProduction(
        "BOKS_OBJECT_STORAGE_SECRET_KEY",
        process.env.BOKS_OBJECT_STORAGE_SECRET_KEY,
      ),
    );
    errors.push(
      ...requiredProduction("BOKS_AI_SERVICE_URL", process.env.BOKS_AI_SERVICE_URL),
    );
    if (
      process.env.BOKS_AI_SERVICE_URL &&
      !process.env.BOKS_AI_SERVICE_URL.startsWith("https://")
    )
      errors.push("生产环境 BOKS_AI_SERVICE_URL 必须使用 HTTPS。");
    if (
      process.env.BOKS_OBJECT_STORAGE_ENDPOINT &&
      !process.env.BOKS_OBJECT_STORAGE_ENDPOINT.startsWith("https://")
    )
      errors.push("生产环境 BOKS_OBJECT_STORAGE_ENDPOINT 必须使用 HTTPS。");
    if (process.env.BOKS_STORAGE_MODE !== "postgres")
      errors.push("生产环境 BOKS_STORAGE_MODE 必须为 postgres。");
    if (process.env.BOKS_ENABLE_DEV_AUTH === "true")
      errors.push("生产环境不能启用 BOKS_ENABLE_DEV_AUTH。");
    const lifecycleDays = Number(
      process.env.BOKS_OBJECT_STORAGE_LIFECYCLE_DAYS ?? 30,
    );
    if (!Number.isInteger(lifecycleDays) || lifecycleDays < 1)
      errors.push(
        "生产环境 BOKS_OBJECT_STORAGE_LIFECYCLE_DAYS 必须是大于 0 的整数。",
      );
    const corsOrigin = process.env.BOKS_CORS_ORIGIN;
    if (!corsOrigin || corsOrigin === "*" || corsOrigin === "true")
      errors.push("生产环境必须配置明确的 BOKS_CORS_ORIGIN。");
  }
  const port = Number(process.env.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    errors.push("API_PORT 必须是 1—65535 的整数。");
  const publicHost = process.env.BOKS_PUBLIC_HOST;
  if (publicHost && isIP(publicHost) === 0 && !publicHost.includes("."))
    errors.push("BOKS_PUBLIC_HOST 必须是合法域名或 IP 地址。");
  if (errors.length > 0)
    throw new Error(`运行配置校验失败：\n- ${errors.join("\n- ")}`);
}
