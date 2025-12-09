import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateReportResponseDto {
  @ApiProperty({
    description: "Identifier of the stored report record.",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  reportId!: string;

  @ApiPropertyOptional({
    description: "Supabase Storage path of the uploaded PDF.",
    example: "123456/4b2c6d90-2f8e-4b1a-bc72-7ec48c9d1c3f.pdf",
  })
  pdfPath?: string;

  @ApiPropertyOptional({
    description:
      "Institution identifier associated with the report (may fall back to numerRspo).",
    example: "123456",
  })
  institutionId?: string;
}

