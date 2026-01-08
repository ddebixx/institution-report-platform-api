import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";
import express from "express";

const expressApp = express();
const adapter = new ExpressAdapter(expressApp);

let cachedApp: INestApplication | null = null;

async function createNestApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const app = await NestFactory.create(AppModule, adapter, {
    bufferLogs: true,
  });

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "https://institution-report-platform-app.vercel.app",
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed =
        allowedOrigins.some((allowed) => allowed && origin === allowed) ||
        origin.endsWith(".vercel.app");

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(
          new Error(
            `CORS policy: Origin ${origin} is not allowed. Please contact support if you believe this is an error.`
          )
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Institution Report API")
    .setDescription("API for submitting reports with Supabase authentication.")
    .setVersion("1.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Supabase access token retrieved after user login.",
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.init();

  cachedApp = app;
  return app;
}

export default async (req: any, res: any) => {
  await createNestApp();
  return expressApp(req, res);
};
