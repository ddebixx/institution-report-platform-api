import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ModeratorResponseDto {
  @ApiProperty({
    description: "Unique identifier (UUID) of the moderator.",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  uuid!: string;

  @ApiProperty({
    description: "Full name of the moderator.",
    example: "John Doe",
  })
  fullname!: string;

  @ApiProperty({
    description: "Email address of the moderator.",
    example: "john.doe@example.com",
  })
  email!: string;

  @ApiPropertyOptional({
    description: "URL or path to the moderator's image.",
    example: "https://example.com/images/moderator.jpg",
  })
  image?: string;

  @ApiProperty({
    description: "ISO timestamp when the moderator was created.",
    example: "2024-01-10T08:00:00Z",
  })
  createdAt!: string;
}

