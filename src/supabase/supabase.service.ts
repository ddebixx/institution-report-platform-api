import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient, createClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const supabaseServiceRoleKey = this.config.get<string>(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new InternalServerErrorException(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
      );
    }

    this.client = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}

