import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  
  try {
    logger.log("Starting application...");
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

  const config = app.get(ConfigService);
  const allowedOrigins = [
    config.get<string>("FRONTEND_URL"),
    "http://localhost:3000",
    "http://localhost:3001",
    "https://institution-report-platform-app.vercel.app/**"
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      
      if (
        allowedOrigins.some(allowed => allowed && origin.startsWith(allowed)) ||
        origin.endsWith('.vercel.app')
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
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

  const port = config.get<number>("PORT") ?? 3000;
  
  const host = config.get<string>("HOST") ?? "0.0.0.0";

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

    await app.listen(port, host);
    logger.log(`HTTP server listening on ${host}:${port}`);
  } catch (error) {
    logger.error("Error during application startup", error);
    throw error;
  }
}

bootstrap().catch((error) => {
  const logger = new Logger("Bootstrap");
  logger.error("=".repeat(60));
  logger.error("CRITICAL: Application failed to start");
  logger.error("=".repeat(60));
  logger.error("Error details:", error);
  if (error instanceof Error) {
    logger.error(`Error message: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
  }
  logger.error("=".repeat(60));
  console.error("FATAL ERROR:", error);
  process.exit(1);
});

