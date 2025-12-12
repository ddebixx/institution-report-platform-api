import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient, createClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const supabaseSecretRoleKey = this.config.get<string>(
      "SUPABASE_SECRET_ROLE_KEY"
    );

    if (!supabaseUrl) {
      this.logger.error("SUPABASE_URL environment variable is not set!");
      throw new InternalServerErrorException(
        "SUPABASE_URL environment variable is required but not set. Please configure it in your .env file or environment variables."
      );
    }

    if (!supabaseSecretRoleKey) {
      this.logger.error("SUPABASE_SECRET_ROLE_KEY environment variable is not set!");
      throw new InternalServerErrorException(
        "SUPABASE_SECRET_ROLE_KEY environment variable is required but not set. Please configure it in your .env file or environment variables."
      );
    }

    try {
      this.logger.log("Initializing Supabase client...");
      this.client = createClient(supabaseUrl, supabaseSecretRoleKey);
      this.logger.log("Supabase client initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Supabase client", error);
      throw new InternalServerErrorException(
        `Failed to initialize Supabase client: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}

