import { z } from "zod";

export const healthResponseSchema = z.object({
  service: z.string(),
  status: z.literal("ok"),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const platformSchema = z.enum([
  "wechat-mini-program",
  "android",
  "ios",
  "admin-web",
]);

export type Platform = z.infer<typeof platformSchema>;
