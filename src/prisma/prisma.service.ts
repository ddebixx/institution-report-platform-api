import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  constructor() {
    super({
      log: ["error", "warn"],
    });
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      this.logger.warn("=".repeat(80));
      this.logger.warn("WARNING: DATABASE_URL is not set. Prisma will not be available.");
      this.logger.warn("=".repeat(80));
      this.logger.warn("If you want to use Prisma, add DATABASE_URL to your .env file.");
      this.logger.warn("For Supabase users: Get your connection string from");
      this.logger.warn("Settings > Database > Connection string (URI format)");
      this.logger.warn("=".repeat(80));
      return;
    }

    try {
      this.logger.log("Connecting to database via Prisma...");
      await this.$connect();
      this.isConnected = true;
      this.logger.log("Successfully connected to database via Prisma");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const fullError = `Failed to connect to database: ${errorMessage}. Please check your DATABASE_URL environment variable and ensure the database is accessible.`;
      this.logger.error("=".repeat(80));
      this.logger.error("DATABASE CONNECTION FAILED");
      this.logger.error("=".repeat(80));
      this.logger.error(fullError);
      this.logger.error("Error details:", error);
      console.error("=".repeat(80));
      console.error("DATABASE CONNECTION FAILED");
      console.error("=".repeat(80));
      console.error(fullError);
      console.error("Error:", error);
      throw new Error(fullError);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log("Disconnected from database");
    } catch (error) {
      this.logger.error("Error disconnecting from database", error);
    }
  }
}

