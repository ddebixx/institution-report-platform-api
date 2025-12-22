import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { ModeratorsModule } from "../moderators/moderators.module";
import { ReportsController } from "./controller/reports.controller";
import { ReportsService } from "./service/reports.service";
import { ReportsRepository } from "./repository/reports.repository";

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    EmailModule,
    ModeratorsModule,
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository],
})
export class ReportsModule {}

