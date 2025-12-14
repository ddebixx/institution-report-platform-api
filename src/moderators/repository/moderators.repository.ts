import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import type { ModeratorEntity, ModeratorDbEntity } from "../entities/moderator.entity";

@Injectable()
export class ModeratorsRepository {
  private readonly logger = new Logger(ModeratorsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private dbToEntity(dbEntity: ModeratorDbEntity): ModeratorEntity {
    return {
      id: dbEntity.id,
      fullname: dbEntity.full_name,
      email: dbEntity.email,
      image: dbEntity.image_url || null,
      created_at: dbEntity.created_at,
    };
  }

  private entityToDb(entity: Partial<ModeratorEntity>): Partial<ModeratorDbEntity> {
    const dbEntity: Partial<ModeratorDbEntity> = {};
    if (entity.id !== undefined) dbEntity.id = entity.id;
    if (entity.fullname !== undefined) dbEntity.full_name = entity.fullname;
    if (entity.email !== undefined) dbEntity.email = entity.email;
    if (entity.image !== undefined) dbEntity.image_url = entity.image;
    if (entity.created_at !== undefined) dbEntity.created_at = entity.created_at;
    return dbEntity;
  }

  async findAll(): Promise<ModeratorEntity[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("moderators")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch moderators: ${error.message}`, error);
      throw error;
    }

    return (data || []).map((dbEntity) => this.dbToEntity(dbEntity as ModeratorDbEntity));
  }

  async findById(moderatorId: string): Promise<ModeratorEntity | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("moderators")
      .select("*")
      .eq("id", moderatorId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch moderator ${moderatorId}: ${error.message}`,
        error
      );
      throw error;
    }

    if (!data) {
      return null;
    }

    return this.dbToEntity(data as ModeratorDbEntity);
  }

  async create(moderatorData: Partial<ModeratorEntity>): Promise<ModeratorEntity> {
    const client = this.supabase.getClient();

    const dbData = this.entityToDb(moderatorData);
    this.logger.debug(`Creating moderator with data: ${JSON.stringify(dbData)}`);

    const { data, error } = await client
      .from("moderators")
      .insert(dbData)
      .select("*")
      .single();

    if (error) {
      this.logger.error(`Failed to create moderator: ${error.message}`, error);
      this.logger.error(`Error code: ${error.code}, Details: ${JSON.stringify(error)}`);
      const errorMessage = error.message || 'Failed to create moderator';
      const dbError = new Error(`Database error: ${errorMessage}`);
      (dbError as any).code = error.code;
      (dbError as any).details = error.details;
      throw dbError;
    }

    if (!data) {
      throw new Error("Moderator was created but no data was returned");
    }

    return this.dbToEntity(data as ModeratorDbEntity);
  }

  async update(
    moderatorId: string,
    updateData: Partial<ModeratorEntity>
  ): Promise<ModeratorEntity> {
    const client = this.supabase.getClient();

    const dbData = this.entityToDb(updateData);
    this.logger.debug(`Updating moderator ${moderatorId} with data: ${JSON.stringify(dbData)}`);

    const { data, error } = await client
      .from("moderators")
      .update(dbData)
      .eq("id", moderatorId)
      .select("*")
      .single();

    if (error) {
      this.logger.error(
        `Failed to update moderator ${moderatorId}: ${error.message}`,
        error
      );
      this.logger.error(`Error code: ${error.code}, Details: ${JSON.stringify(error)}`);
      const errorMessage = error.message || 'Failed to update moderator';
      const dbError = new Error(`Database error: ${errorMessage}`);
      (dbError as any).code = error.code;
      (dbError as any).details = error.details;
      throw dbError;
    }

    if (!data) {
      throw new Error("Moderator was updated but no data was returned");
    }

    return this.dbToEntity(data as ModeratorDbEntity);
  }

  async delete(moderatorId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from("moderators")
      .delete()
      .eq("id", moderatorId);

    if (error) {
      this.logger.error(
        `Failed to delete moderator ${moderatorId}: ${error.message}`,
        error
      );
      throw error;
    }
  }
}

