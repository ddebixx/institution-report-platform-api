import { ApiProperty } from "@nestjs/swagger";

export class AssignReportResponseDto {
  @ApiProperty({
    description: "Success message indicating the report was assigned.",
    example: "Report assigned successfully",
  })
  message!: string;

  @ApiProperty({
    description: "The ID of the report that was assigned.",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  reportId!: string;

  @ApiProperty({
    description: "The ID of the moderator (user) who was assigned the report.",
    example: "user-uuid-here",
  })
  moderatorId!: string;
}

