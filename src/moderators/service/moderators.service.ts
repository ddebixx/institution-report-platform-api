import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { extname } from "path";
import { ModeratorsRepository } from "../repository/moderators.repository";
import { ModeratorMapper } from "../repository/moderator.mapper";
import { CreateModeratorDto } from "../dto/create-moderator.dto";
import { UpdateModeratorDto } from "../dto/update-moderator.dto";
import { ModeratorResponseDto } from "../dto/moderator-response.dto";
import type { ModeratorEntity } from "../entities/moderator.entity";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class ModeratorsService {
  private readonly logger = new Logger(ModeratorsService.name);
  private readonly imageBucket: string;

  constructor(
    private readonly repository: ModeratorsRepository,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {
    this.imageBucket = this.config.get<string>("SUPABASE_IMAGE_BUCKET") ?? "moderator-images";
  }

  async create(dto: CreateModeratorDto): Promise<ModeratorResponseDto> {
    try {
      const existing = await this.repository.findById(dto.uuid);
      
      if (existing) {
        this.logger.warn(`Moderator with UUID ${dto.uuid} already exists`);
        throw new ConflictException(
          `Moderator with UUID ${dto.uuid} already exists`
        );
      }

      const moderator = await this.repository.create({
        id: dto.uuid,
        fullname: dto.fullname,
        email: dto.email,
        image: dto.image || null,
        created_at: new Date().toISOString(),
      });

      this.logger.log(`Created moderator with UUID ${dto.uuid}`);
      return ModeratorMapper.toResponseDto(moderator);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(
        `Error in create: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to create moderator: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findAll(): Promise<ModeratorResponseDto[]> {
    try {
      const entities = await this.repository.findAll();
      this.logger.log(`Fetched ${entities.length} moderators`);
      return ModeratorMapper.toResponseDtos(entities);
    } catch (error) {
      this.logger.error(
        `Error in findAll: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch moderators: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findOne(uuid: string): Promise<ModeratorResponseDto> {
    try {
      const moderator = await this.repository.findById(uuid);
      if (!moderator) {
        this.logger.error(`Moderator not found: ${uuid}`);
        throw new NotFoundException(`Moderator with UUID ${uuid} not found`);
      }
      return ModeratorMapper.toResponseDto(moderator);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error in findOne: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch moderator: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async update(
    uuid: string,
    dto: UpdateModeratorDto
  ): Promise<ModeratorResponseDto> {
    try {
      const existing = await this.repository.findById(uuid);
      if (!existing) {
        this.logger.error(`Moderator not found: ${uuid}`);
        throw new NotFoundException(`Moderator with UUID ${uuid} not found`);
      }

      const updateData: Partial<ModeratorEntity> = {};
      if (dto.fullname !== undefined) {
        updateData.fullname = dto.fullname;
      }
      if (dto.email !== undefined) {
        updateData.email = dto.email;
      }
      if (dto.image !== undefined) {
        updateData.image = dto.image || null;
      }

      const updated = await this.repository.update(uuid, updateData);
      this.logger.log(`Updated moderator with UUID ${uuid}`);
      return ModeratorMapper.toResponseDto(updated);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error in update: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to update moderator: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async delete(uuid: string): Promise<void> {
    try {
      const existing = await this.repository.findById(uuid);
      if (!existing) {
        this.logger.error(`Moderator not found: ${uuid}`);
        throw new NotFoundException(`Moderator with UUID ${uuid} not found`);
      }

      await this.repository.delete(uuid);
      this.logger.log(`Deleted moderator with UUID ${uuid}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error in delete: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to delete moderator: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async getProfileByUserId(userId: string): Promise<ModeratorResponseDto | null> {
    try {
      const moderator = await this.repository.findById(userId);
      if (!moderator) {
        return null;
      }
      return ModeratorMapper.toResponseDto(moderator);
    } catch (error) {
      this.logger.error(
        `Error in getProfileByUserId: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch moderator profile: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async createOrUpdateProfile(
    userId: string,
    fullName: string,
    email: string,
    image?: Express.Multer.File
  ): Promise<ModeratorResponseDto> {
    try {
      const client = this.supabase.getClient();
      let imageUrl: string | null = null;

      if (image) {
        const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        
        if (!allowedMimeTypes.includes(image.mimetype)) {
          throw new ConflictException(
            "Invalid image type. Only JPEG, PNG, GIF, and WebP images are allowed."
          );
        }

        const maxSize = 5 * 1024 * 1024;
        
        if (image.size > maxSize) {
          throw new ConflictException("Image size must be less than 5MB.");
        }

        const extension = extname(image.originalname || "image.jpg") || ".jpg";
        const uniqueId = randomUUID();
        const storagePath = `profiles/${userId}/${uniqueId}${extension}`;

        const { data, error } = await client.storage
          .from(this.imageBucket)
          .upload(storagePath, image.buffer, {
            contentType: image.mimetype,
            upsert: true,
          });

        if (error) {
          this.logger.error(`Failed to upload image: ${error.message}`, error);
          throw new InternalServerErrorException(
            `Failed to upload image: ${error.message}`
          );
        }

        imageUrl = data.path;
      }

      const existing = await this.repository.findById(userId);

      if (existing) {
        const updateData: Partial<ModeratorEntity> = {
          fullname: fullName,
          email: email,
        };

        if (imageUrl !== null) {
          updateData.image = imageUrl;
        }

        const updated = await this.repository.update(userId, updateData);
        this.logger.log(`Updated moderator profile for user ${userId}`);
        return ModeratorMapper.toResponseDto(updated);
      } else {
        const moderator = await this.repository.create({
          id: userId,
          fullname: fullName,
          email: email,
          image: imageUrl,
          created_at: new Date().toISOString(),
        });

        this.logger.log(`Created moderator profile for user ${userId}`);
        return ModeratorMapper.toResponseDto(moderator);
      }
    } catch (error) {
      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }
      
      this.logger.error(
        `Error in createOrUpdateProfile: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      
      if (error && typeof error === 'object') {
        this.logger.error(`Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      }
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Unknown error';
      
      throw new InternalServerErrorException(
        `Failed to create/update moderator profile: ${errorMessage}`
      );
    }
  }
}

