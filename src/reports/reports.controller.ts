import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CreateReportDto } from "./dto/create-report.dto";
import { CreateReportResponseDto } from "./dto/create-report-response.dto";
import { ReportsService } from "./reports.service";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("pdf", {
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
          return cb(new Error("Only PDF files are allowed"), false);
        }
        cb(null, true);
      },
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Create a report",
    description:
      "Uploads a PDF to Supabase Storage and stores the report metadata. No authentication required.",
  })
  @ApiBody({
    required: true,
    description: "Report payload with metadata and the PDF file.",
    schema: {
      type: "object",
      properties: {
        pdf: {
          type: "string",
          format: "binary",
          description: "PDF file to upload.",
        },
        reporterName: { type: "string", example: "Jane Doe" },
        reporterEmail: { type: "string", example: "jane.doe@example.com" },
        reportedInstitution: {
          type: "string",
          example: "Some Institution",
        },
        reportDescription: {
          type: "string",
          example: "Reports of non-compliance with internal policy.",
        },
        reportContent: {
          type: "string",
          description:
            "JSON string of additional structured metadata (e.g., '{\"category\":\"safety\",\"severity\":\"high\"}')",
          example: '{"category":"safety","severity":"high"}',
        },
        institutionName: {
          type: "string",
          example: "Springfield University",
        },
        institutionId: { type: "string", example: "inst-42" },
        numerRspo: { type: "string", example: "123456" },
        reportReason: { type: "string", example: "policy_violation" },
      },
      required: ["pdf", "reporterName", "reporterEmail"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Report created successfully.",
    type: CreateReportResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: "Validation failed or PDF upload failed.",
  })
  async createReport(
    @Body() dto: CreateReportDto,
    @UploadedFile() pdf: Express.Multer.File | undefined
  ): Promise<CreateReportResponseDto> {
    return this.reportsService.create(dto, pdf);
  }
}

