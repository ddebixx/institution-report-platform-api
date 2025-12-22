import { ApiProperty } from "@nestjs/swagger";

export class ReviewReportResponseDto {
  @ApiProperty({
    description: "Success message indicating the report was reviewed.",
    example: "Report reviewed successfully",
  })
  message!: string;

  @ApiProperty({
    description: "The ID of the report that was reviewed.",
    example: "a3b4c5d6-e7f8-9012-3456-7890abcdef12",
  })
  reportId!: string;

  @ApiProperty({
    description: "The updated status of the report.",
    example: "completed",
  })
  status!: string;
}
