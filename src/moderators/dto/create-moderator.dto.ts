import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateModeratorDto {
  @ApiProperty({
    description: "UUID of the moderator (must be a valid UUID).",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  @IsUUID()
  @IsNotEmpty()
  uuid: string;

  @ApiProperty({
    description: "Full name of the moderator.",
    example: "John Doe",
  })
  @IsString()
  @IsNotEmpty()
  fullname: string;

  @ApiProperty({
    description: "Email address of the moderator.",
    example: "john.doe@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: "URL or path to the moderator's image.",
    example: "https://example.com/images/moderator.jpg",
  })
  @IsOptional()
  @IsString()
  image?: string;
}

