import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReportResponseDto {
  @ApiProperty({
    description: "Unique identifier of the report.",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  id!: string;

  @ApiProperty({
    description: "Full name of the reporter.",
    example: "Jane Doe",
  })
  reporterName!: string;

  @ApiProperty({
    description: "Contact email of the reporter.",
    example: "jane.doe@example.com",
  })
  reporterEmail!: string;

  @ApiPropertyOptional({
    description: "Name of the institution being reported.",
    example: "Some Institution",
  })
  reportedInstitution?: string;

  @ApiPropertyOptional({
    description: "Display name of the institution.",
    example: "Springfield University",
  })
  institutionName?: string;

  @ApiPropertyOptional({
    description: "Primary institution identifier.",
    example: "inst-42",
  })
  institutionId?: string;

  @ApiPropertyOptional({
    description: "Institution registry number (numer RSPO).",
    example: "123456",
  })
  numerRspo?: string;

  @ApiPropertyOptional({
    description: "Short description of the report context.",
    example: "Reports of non-compliance with internal policy.",
  })
  reportDescription?: string;

  @ApiPropertyOptional({
    description: "Reason for submitting the report.",
    example: "policy_violation",
  })
  reportReason?: string;

  @ApiProperty({
    description: "Current status of the report.",
    example: "pending",
    enum: ["pending", "assigned", "completed"],
  })
  status!: "pending" | "assigned" | "completed";

  @ApiPropertyOptional({
    description: "User ID of the moderator assigned to this report.",
    example: "user-uuid-here",
  })
  assignedTo?: string;

  @ApiPropertyOptional({
    description: "ISO timestamp when the report was assigned.",
    example: "2024-01-15T10:30:00Z",
  })
  assignedAt?: string;

  @ApiPropertyOptional({
    description: "ISO timestamp when the report was completed.",
    example: "2024-01-20T14:45:00Z",
  })
  completedAt?: string;

  @ApiProperty({
    description: "ISO timestamp when the report was created.",
    example: "2024-01-10T08:00:00Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "ISO timestamp when the report was last updated.",
    example: "2024-01-15T10:30:00Z",
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: "Supabase Storage path of the uploaded PDF.",
    example: "123456/4b2c6d90-2f8e-4b1a-bc72-7ec48c9d1c3f.pdf",
  })
  pdfPath?: string;

  @ApiPropertyOptional({
    description: "Report content including findings and comparison notes from the user or moderator review.",
    example: {
      findings: [
        {
          id: "finding-1",
          detail: "Non-compliance with section 3.2",
          regulationId: "reg-1",
          pageReference: "5",
        },
      ],
      comparisonNotes: "The document shows several areas of concern.",
    },
  })
  reportContent?: {
    findings?: Array<{
      id: string;
      detail: string;
      regulationId?: string;
      pageReference?: string;
    }>;
    comparisonNotes?: string;
  };
}

