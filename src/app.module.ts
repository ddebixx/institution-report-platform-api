import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { ModeratorsModule } from "./moderators/moderators.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    ReportsModule,
    ModeratorsModule,
  ],
})
export class AppModule {}

