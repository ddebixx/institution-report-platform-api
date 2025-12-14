import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateOrUpdateProfileDto {
  @ApiProperty({
    description: "Full name of the moderator.",
    example: "John Doe",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    description: "Email address of the moderator.",
    example: "john.doe@example.com",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({
    description: "Profile image file (JPEG, PNG, GIF, WebP).",
    type: "string",
    format: "binary",
  })
  @IsOptional()
  image?: Express.Multer.File;
}

