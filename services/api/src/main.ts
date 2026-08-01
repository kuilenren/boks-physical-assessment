import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Client-Platform",
      "X-Client-Version",
      "X-Trace-Id",
      "Idempotency-Key",
    ],
  });
  await app.listen(Number(process.env.API_PORT ?? 3000));
}

void bootstrap();
