import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, ValidateNested, IsObject } from "class-validator";
import { Type } from "class-transformer";

class ReportContentDto {
  @ApiPropertyOptional({
    description: "Comparison notes or summary from the moderator.",
    example: "The report has been thoroughly reviewed and all findings have been documented.",
  })
  @IsOptional()
  @IsString()
  comparisonNotes?: string;

  @ApiPropertyOptional({
    description: "Findings from the review.",
  })
  @IsOptional()
  findings?: unknown[];
}

export class ReviewReportDto {
  @ApiPropertyOptional({
    description: "Review notes or comments (legacy field).",
    example: "Report reviewed and approved.",
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @ApiPropertyOptional({
    description: "Report content including comparison notes and findings.",
    type: ReportContentDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportContentDto)
  reportContent?: ReportContentDto;
}