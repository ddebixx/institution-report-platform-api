import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient, createClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>("SUPABASE_URL");
    const supabaseSecretRoleKey = this.config.get<string>(
      "SUPABASE_SECRET_ROLE_KEY"
    );

    if (!supabaseUrl || !supabaseSecretRoleKey) {
      throw new InternalServerErrorException(
        "Missing SUPABASE_URL or SUPABASE_SECRET_ROLE_KEY environment variables."
      );
    }

    this.client = createClient(supabaseUrl, supabaseSecretRoleKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}

