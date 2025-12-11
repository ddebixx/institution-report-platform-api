import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateReportDto {
  @ApiProperty({
    description: "Full name of the reporter submitting the file.",
    example: "Jane Doe",
  })
  @IsString()
  @IsNotEmpty()
  reporterName: string;

  @ApiProperty({
    description: "Contact email of the reporter.",
    example: "jane.doe@example.com",
  })
  @IsEmail()
  reporterEmail: string;

  @ApiPropertyOptional({
    description: "Name of the institution being reported.",
    example: "Some Institution",
  })
  @IsOptional()
  @IsString()
  reportedInstitution?: string;

  @ApiPropertyOptional({
    description: "Short description of the report context.",
    example: "Reports of non-compliance with internal policy.",
  })
  @IsOptional()
  @IsString()
  reportDescription?: string;

  @ApiPropertyOptional({
    description:
      "Additional structured metadata for the report. Must be a valid JSON string when sent via multipart/form-data.",
    example: '{"category":"safety","severity":"high"}',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "string" && value.trim().startsWith("{")) {
      try {
        return JSON.parse(value);
      } catch {
        
        return value;
      }
    }
    
    return value;
  })
  @IsObject({
    message: "reportContent must be a valid JSON object or JSON string",
  })
  reportContent?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Display name of the institution.",
    example: "Springfield University",
  })
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional({
    description: "Primary institution identifier, if known.",
    example: "inst-42",
  })
  @IsOptional()
  @IsString()
  institutionId?: string;

  @ApiPropertyOptional({
    description: "Fallback institution registry number (numer RSPO).",
    example: "123456",
  })
  @IsOptional()
  @IsString()
  numerRspo?: string;

  @ApiPropertyOptional({
    description: "Reason for submitting the report.",
    example: "policy_violation",
  })
  @IsOptional()
  @IsString()
  reportReason?: string;
}

