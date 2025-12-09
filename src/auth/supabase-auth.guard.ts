import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ExtractJwt } from "passport-jwt";
import { SupabaseService } from "../supabase/supabase.service";
import { Request } from "express";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const { data, error } = await this.supabase.getClient().auth.getUser(token);

    if (error || !data?.user) {
      throw new UnauthorizedException(error?.message ?? "Invalid access token");
    }

    req.user = data.user;
    return true;
  }
}

