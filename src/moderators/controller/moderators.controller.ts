import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthUser } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../../auth/supabase-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { ModeratorsService } from "../service/moderators.service";
import { CreateModeratorDto } from "../dto/create-moderator.dto";
import { UpdateModeratorDto } from "../dto/update-moderator.dto";
import { ModeratorResponseDto } from "../dto/moderator-response.dto";
import { CreateOrUpdateProfileDto } from "../dto/create-or-update-profile.dto";

@ApiTags("Moderators")
@Controller("moderators")
@UseGuards(SupabaseAuthGuard)
export class ModeratorsController {
  constructor(private readonly moderatorsService: ModeratorsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a moderator",
    description:
      "Creates a new moderator with the provided UUID, fullname, and optional image. Requires authentication.",
  })
  @ApiResponse({
    status: 201,
    description: "Moderator created successfully.",
    type: ModeratorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation failed.",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 409,
    description: "Moderator with this UUID already exists.",
  })
  async createModerator(
    @Body() dto: CreateModeratorDto
  ): Promise<ModeratorResponseDto> {
    return this.moderatorsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all moderators",
    description:
      "Retrieves all moderators. Requires authentication. Returns moderators ordered by creation date (newest first).",
  })
  @ApiResponse({
    status: 200,
    description: "List of all moderators.",
    type: [ModeratorResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  async getAllModerators(): Promise<ModeratorResponseDto[]> {
    return this.moderatorsService.findAll();
  }

  @Get("profile")
  @ApiOperation({
    summary: "Get current user's moderator profile",
    description:
      "Retrieves the moderator profile for the authenticated user. Returns 404 if profile doesn't exist. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Moderator profile found.",
    type: ModeratorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Moderator profile not found.",
  })
  async getProfile(
    @CurrentUser() user: AuthUser
  ): Promise<ModeratorResponseDto> {
    const profile = await this.moderatorsService.getProfileByUserId(user.id);
    if (!profile) {
      throw new NotFoundException("Moderator profile not found");
    }
    return profile;
  }

  @Post("profile")
  @UseInterceptors(
    FileInterceptor("image", {
      fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (file && !allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new Error(
              "Only JPEG, PNG, GIF, and WebP image files are allowed"
            ),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  )
  @HttpCode(HttpStatus.OK)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Create or update current user's moderator profile",
    description:
      "Creates a new moderator profile or updates an existing one for the authenticated user. Requires authentication. Image upload is optional.",
  })
  @ApiBody({
    required: true,
    description: "Profile data with optional image file.",
    schema: {
      type: "object",
      properties: {
        fullName: {
          type: "string",
          example: "John Doe",
          description: "Full name of the moderator (required).",
        },
        email: {
          type: "string",
          example: "john.doe@example.com",
          description: "Email address of the moderator (required).",
        },
        image: {
          type: "string",
          format: "binary",
          description: "Profile image file (optional, JPEG/PNG/GIF/WebP, max 5MB).",
        },
      },
      required: ["fullName", "email"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Profile created or updated successfully.",
    type: ModeratorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation failed.",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 409,
    description: "Invalid image type or size.",
  })
  async createOrUpdateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrUpdateProfileDto,
    @UploadedFile() image?: Express.Multer.File
  ): Promise<ModeratorResponseDto> {
    return this.moderatorsService.createOrUpdateProfile(
      user.id,
      dto.fullName,
      dto.email,
      image
    );
  }

  @Get(":uuid")
  @ApiOperation({
    summary: "Get a moderator by UUID",
    description:
      "Retrieves a single moderator by their UUID. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Moderator found.",
    type: ModeratorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Moderator not found.",
  })
  async getModerator(@Param("uuid") uuid: string): Promise<ModeratorResponseDto> {
    return this.moderatorsService.findOne(uuid);
  }

  @Put(":uuid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update a moderator",
    description:
      "Updates an existing moderator's fullname and/or image. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Moderator updated successfully.",
    type: ModeratorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation failed.",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Moderator not found.",
  })
  async updateModerator(
    @Param("uuid") uuid: string,
    @Body() dto: UpdateModeratorDto
  ): Promise<ModeratorResponseDto> {
    return this.moderatorsService.update(uuid, dto);
  }

  @Delete(":uuid")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a moderator",
    description:
      "Deletes a moderator by their UUID. Requires authentication.",
  })
  @ApiResponse({
    status: 204,
    description: "Moderator deleted successfully.",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Moderator not found.",
  })
  async deleteModerator(@Param("uuid") uuid: string): Promise<void> {
    return this.moderatorsService.delete(uuid);
  }
}

