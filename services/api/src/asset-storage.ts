import { createHash, createHmac } from "node:crypto";
import { dirname, extname, join } from "node:path";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { isProductionRuntime } from "./runtime-config.js";

const maxBytes = 8 * 1024 * 1024;
const minDimension = 256;
const allowedMimeTypes = ["image/jpeg", "image/png"] as const;
type AllowedMimeType = (typeof allowedMimeTypes)[number];

export type PostureAssetQuality = {
  widthPx: number | null;
  heightPx: number | null;
  status: "passed" | "needs_retake";
  score: number;
  reasons: string[];
};

export type StoredPostureAsset = PostureAssetQuality & {
  storageKey: string;
  checksumSha256: string;
};

export type PresignedPostureUpload = {
  storageKey: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

function extensionForMime(mimeType: AllowedMimeType): string {
  return mimeType === "image/png" ? ".png" : ".jpg";
}

function stableError(
  code: string,
  message: string,
  retryable: boolean,
): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: { code, message, details: [], retryable },
  });
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function assertSafeStorageKey(storageKey: string): void {
  if (
    storageKey.startsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.split("/").some((segment) => segment === ".." || segment === "")
  )
    throw new BadRequestException({
      error: {
        code: "POSTURE_ASSET_KEY_INVALID",
        message: "照片资源键无效。",
        details: [],
        retryable: false,
      },
    });
}

function hashHmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function imageDimensions(
  bytes: Buffer,
  mimeType: AllowedMimeType,
): { width: number; height: number } | null {
  if (mimeType === "image/png" && bytes.length >= 24)
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  if (mimeType !== "image/jpeg" || bytes.length < 4) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xc3 &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame && segmentLength >= 7)
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    offset += segmentLength;
  }
  return null;
}

export function inspectPostureImage(
  bytes: Buffer,
  mimeType: AllowedMimeType,
): PostureAssetQuality {
  const dimensions = imageDimensions(bytes, mimeType);
  const reasons: string[] = [];
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0)
    reasons.push("无法读取照片尺寸，请重新选择原始照片。");
  else {
    if (dimensions.width < minDimension || dimensions.height < minDimension)
      reasons.push(`照片宽高都应至少为 ${minDimension} 像素。`);
    const ratio = dimensions.width / dimensions.height;
    if (ratio < 0.25 || ratio > 4)
      reasons.push("照片比例异常，请确保人体主体完整且相机方向正确。");
  }
  if (bytes.length < 1024)
    reasons.push("照片文件过小，无法进行可靠的质量检查。");
  const score =
    reasons.length === 0 ? 0.9 : Math.max(0, 0.9 - reasons.length * 0.3);
  return {
    widthPx: dimensions?.width ?? null,
    heightPx: dimensions?.height ?? null,
    status: reasons.length === 0 ? "passed" : "needs_retake",
    score,
    reasons,
  };
}

function assertImageBytes(bytes: Buffer, mimeType: AllowedMimeType): void {
  if (bytes.length === 0 || bytes.length > maxBytes)
    throw new BadRequestException({
      error: {
        code: "POSTURE_ASSET_TOO_LARGE",
        message: "照片大小必须在 1B—8MB 范围内。",
        details: [],
        retryable: false,
      },
    });
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (
    (mimeType === "image/jpeg" && !isJpeg) ||
    (mimeType === "image/png" && !isPng)
  )
    throw new BadRequestException({
      error: {
        code: "POSTURE_ASSET_CONTENT_INVALID",
        message: "照片内容与声明的图片格式不一致。",
        details: [],
        retryable: false,
      },
    });
}

function objectStorageConfig(): {
  bucket: string;
  endpoint: URL;
  region: string;
  accessKey: string;
  secretKey: string;
  sessionToken: string | undefined;
  kmsKeyId: string | undefined;
} | null {
  const bucket = process.env.BOKS_OBJECT_STORAGE_BUCKET?.trim();
  const accessKey = process.env.BOKS_OBJECT_STORAGE_ACCESS_KEY?.trim();
  const secretKey = process.env.BOKS_OBJECT_STORAGE_SECRET_KEY?.trim();
  if (!bucket || !accessKey || !secretKey) {
    if (isProductionRuntime())
      throw stableError(
        "OBJECT_STORAGE_NOT_CONFIGURED",
        "生产环境尚未完成私有对象存储凭证配置。",
        false,
      );
    return null;
  }
  const region = process.env.BOKS_OBJECT_STORAGE_REGION?.trim() || "auto";
  const endpointValue =
    process.env.BOKS_OBJECT_STORAGE_ENDPOINT?.trim() ||
    `https://s3.${region}.amazonaws.com`;
  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw stableError(
      "OBJECT_STORAGE_ENDPOINT_INVALID",
      "对象存储 endpoint 不是合法 HTTPS 地址。",
      false,
    );
  }
  if (endpoint.protocol !== "https:" && isProductionRuntime())
    throw stableError(
      "OBJECT_STORAGE_ENDPOINT_INSECURE",
      "生产对象存储必须使用 HTTPS。",
      false,
    );
  return {
    bucket,
    endpoint,
    region,
    accessKey,
    secretKey,
    sessionToken: process.env.BOKS_OBJECT_STORAGE_SESSION_TOKEN?.trim(),
    kmsKeyId: process.env.BOKS_OBJECT_STORAGE_KMS_KEY_ID?.trim(),
  };
}

function signedRequest(
  config: NonNullable<ReturnType<typeof objectStorageConfig>>,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  body: Buffer | undefined,
  mimeType: AllowedMimeType | undefined,
): { url: URL; headers: Record<string, string> } {
  const url = objectUrl(config, key);
  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .replace("Z", "Z");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256")
    .update(body ?? Buffer.alloc(0))
    .digest("hex");
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (method === "PUT") {
    headers["x-amz-server-side-encryption"] = config.kmsKeyId
      ? "aws:kms"
      : "AES256";
    if (mimeType) headers["content-type"] = mimeType;
    if (config.kmsKeyId)
      headers["x-amz-server-side-encryption-aws-kms-key-id"] = config.kmsKeyId;
  }
  if (config.sessionToken)
    headers["x-amz-security-token"] = config.sessionToken;
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const dateKey = hashHmac(`AWS4${config.secretKey}`, dateStamp);
  const regionKey = hashHmac(dateKey, config.region);
  const serviceKey = hashHmac(regionKey, "s3");
  const signingKey = hashHmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url, headers };
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function presignedPutRequest(
  config: NonNullable<ReturnType<typeof objectStorageConfig>>,
  key: string,
  mimeType: AllowedMimeType,
  expiresInSeconds = 600,
): PresignedPostureUpload {
  const url = objectUrl(config, key);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const requiredHeaders: Record<string, string> = {
    "content-type": mimeType,
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    "x-amz-server-side-encryption": config.kmsKeyId ? "aws:kms" : "AES256",
  };
  if (config.kmsKeyId)
    requiredHeaders["x-amz-server-side-encryption-aws-kms-key-id"] =
      config.kmsKeyId;
  const signedHeaders = ["host", ...Object.keys(requiredHeaders).sort()].join(
    ";",
  );
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  if (config.sessionToken) query["X-Amz-Security-Token"] = config.sessionToken;
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeQuery(name)}=${encodeQuery(value)}`)
    .join("&");
  const canonicalHeaders = [
    `host:${url.host}`,
    ...Object.keys(requiredHeaders)
      .sort()
      .map((name) => `${name}:${requiredHeaders[name].trim()}`),
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    url.pathname,
    canonicalQuery,
    `${canonicalHeaders}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const dateKey = hashHmac(`AWS4${config.secretKey}`, dateStamp);
  const regionKey = hashHmac(dateKey, config.region);
  const serviceKey = hashHmac(regionKey, "s3");
  const signingKey = hashHmac(serviceKey, "aws4_request");
  query["X-Amz-Signature"] = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  for (const [name, value] of Object.entries(query))
    url.searchParams.set(name, value);
  return {
    storageKey: key,
    uploadUrl: url.toString(),
    requiredHeaders,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
  };
}

async function putObject(
  config: NonNullable<ReturnType<typeof objectStorageConfig>>,
  key: string,
  bytes: Buffer,
  mimeType: AllowedMimeType,
): Promise<void> {
  const request = signedRequest(config, "PUT", key, bytes, mimeType);
  const response = await fetch(request.url, {
    method: "PUT",
    headers: request.headers,
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw stableError(
      "OBJECT_STORAGE_UPLOAD_FAILED",
      "照片上传到私有对象存储失败。",
      response.status >= 500,
    );
}

async function deleteObject(
  config: NonNullable<ReturnType<typeof objectStorageConfig>>,
  key: string,
): Promise<void> {
  const request = signedRequest(config, "DELETE", key, undefined, undefined);
  const response = await fetch(request.url, {
    method: "DELETE",
    headers: request.headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404)
    throw stableError(
      "OBJECT_STORAGE_DELETE_FAILED",
      "照片对象删除失败，需要重试并完成删除证明。",
      response.status >= 500,
    );
}

async function getObject(
  config: NonNullable<ReturnType<typeof objectStorageConfig>>,
  key: string,
): Promise<{ bytes: Buffer; mimeType: AllowedMimeType | undefined }> {
  const request = signedRequest(config, "GET", key, undefined, undefined);
  const response = await fetch(request.url, {
    method: "GET",
    headers: request.headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw stableError(
      "OBJECT_STORAGE_READ_FAILED",
      "照片未能从私有对象存储读取。",
      response.status >= 500,
    );
  const contentType = response.headers.get("content-type")?.split(";")[0];
  const mimeType =
    contentType === "image/jpeg" || contentType === "image/png"
      ? contentType
      : undefined;
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType,
  };
}

export function createPostureUploadUrl(input: {
  assetId: string;
  mimeType: AllowedMimeType;
}): PresignedPostureUpload {
  const config = objectStorageConfig();
  if (!config)
    throw stableError(
      "OBJECT_STORAGE_NOT_CONFIGURED",
      "当前环境未配置预签名对象存储上传。",
      false,
    );
  const storageKey = `posture/${input.assetId}${extensionForMime(input.mimeType)}`;
  return presignedPutRequest(config, storageKey, input.mimeType);
}

export async function completePostureUpload(input: {
  storageKey: string;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  checksumSha256: string;
}): Promise<StoredPostureAsset> {
  const config = objectStorageConfig();
  if (!config)
    throw stableError(
      "OBJECT_STORAGE_NOT_CONFIGURED",
      "当前环境未配置对象存储上传确认。",
      false,
    );
  const object = await getObject(config, input.storageKey);
  if (object.bytes.length !== input.sizeBytes)
    throw new BadRequestException({
      error: {
        code: "POSTURE_ASSET_SIZE_MISMATCH",
        message: "对象存储中的照片大小与上传声明不一致。",
        details: [],
        retryable: false,
      },
    });
  const checksumSha256 = createHash("sha256")
    .update(object.bytes)
    .digest("hex");
  if (checksumSha256 !== input.checksumSha256)
    throw new BadRequestException({
      error: {
        code: "POSTURE_ASSET_CHECKSUM_MISMATCH",
        message: "对象存储中的照片校验和不一致。",
        details: [],
        retryable: false,
      },
    });
  assertImageBytes(object.bytes, input.mimeType);
  if (object.mimeType && object.mimeType !== input.mimeType)
    throw new BadRequestException({
      error: {
        code: "POSTURE_ASSET_MIME_MISMATCH",
        message: "对象存储中的图片类型与上传声明不一致。",
        details: [],
        retryable: false,
      },
    });
  const quality = inspectPostureImage(object.bytes, input.mimeType);
  return {
    ...quality,
    storageKey: input.storageKey,
    checksumSha256,
  };
}

export async function savePostureAsset(input: {
  assetId: string;
  mimeType: AllowedMimeType;
  bytes: Buffer;
}): Promise<StoredPostureAsset> {
  assertImageBytes(input.bytes, input.mimeType);
  const quality = inspectPostureImage(input.bytes, input.mimeType);
  const storageKey = `posture/${input.assetId}${extensionForMime(input.mimeType)}`;
  const config = objectStorageConfig();
  if (config) await putObject(config, storageKey, input.bytes, input.mimeType);
  else {
    const root =
      process.env.BOKS_ASSET_DIR ??
      join(process.cwd(), "data", "posture-assets");
    const path = join(root, storageKey);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, input.bytes, { flag: "wx", mode: 0o600 });
  }
  return {
    ...quality,
    storageKey,
    checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export async function deletePostureAsset(
  storageKey: string | undefined,
): Promise<void> {
  if (!storageKey) return;
  assertSafeStorageKey(storageKey);
  const config = objectStorageConfig();
  if (config) {
    await deleteObject(config, storageKey);
    return;
  }
  if (isProductionRuntime()) return;
  const root =
    process.env.BOKS_ASSET_DIR ?? join(process.cwd(), "data", "posture-assets");
  const path = join(
    root,
    extname(storageKey) ? storageKey : `${storageKey}.jpg`,
  );
  try {
    unlinkSync(path);
  } catch (error) {
    const code = error as NodeJS.ErrnoException;
    if (code.code !== "ENOENT") throw error;
  }
}

function objectUrl(
  config: NonNullable<ReturnType<typeof objectStorageConfig>>,
  key: string,
): URL {
  assertSafeStorageKey(key);
  const url = new URL(config.endpoint);
  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}/${encodePathSegment(config.bucket)}/${key
    .split("/")
    .map(encodePathSegment)
    .join("/")}`;
  return url;
}
