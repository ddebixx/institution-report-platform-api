import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";

export class UpdateModeratorDto {
  @ApiPropertyOptional({
    description: "Full name of the moderator.",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  fullname?: string;

  @ApiPropertyOptional({
    description: "Email address of the moderator.",
    example: "john.doe@example.com",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "URL or path to the moderator's image.",
    example: "https://example.com/images/moderator.jpg",
  })
  @IsOptional()
  @IsString()
  image?: string;
}

