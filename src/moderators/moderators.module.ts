import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { ModeratorsController } from "./controller/moderators.controller";
import { ModeratorsService } from "./service/moderators.service";
import { ModeratorsRepository } from "./repository/moderators.repository";

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [ModeratorsController],
  providers: [ModeratorsService, ModeratorsRepository],
})
export class ModeratorsModule {}

