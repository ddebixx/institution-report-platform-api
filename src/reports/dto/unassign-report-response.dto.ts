import { ApiProperty } from "@nestjs/swagger";

export class UnassignReportResponseDto {
  @ApiProperty({
    description: "Success message indicating the report was unassigned.",
    example: "Report unassigned successfully",
  })
  message!: string;

  @ApiProperty({
    description: "The ID of the report that was unassigned.",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  reportId!: string;
}
