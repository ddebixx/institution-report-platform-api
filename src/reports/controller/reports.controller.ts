import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthUser } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../../auth/supabase-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { ReportsService } from "../service/reports.service";
import { CreateReportDto } from "../dto/create-report.dto";
import { CreateReportResponseDto } from "../dto/create-report-response.dto";
import { ReportResponseDto } from "../dto/report-response.dto";
import { AssignReportResponseDto } from "../dto/assign-report-response.dto";
import { UnassignReportResponseDto } from "../dto/unassign-report-response.dto";
import { ReviewReportDto } from "../dto/review-report.dto";
import { ReviewReportResponseDto } from "../dto/review-report-response.dto";

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
  @HttpCode(HttpStatus.CREATED)
  async createReport(
    @Body() dto: CreateReportDto,
    @UploadedFile() pdf: Express.Multer.File | undefined
  ): Promise<CreateReportResponseDto> {
    return this.reportsService.create(dto, pdf);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: "Get all reports",
    description:
      "Retrieves all reports. Requires authentication. Returns reports ordered by creation date (newest first).",
  })
  @ApiResponse({
    status: 200,
    description: "List of all reports.",
    type: [ReportResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  async getAllReports(): Promise<ReportResponseDto[]> {
    return this.reportsService.findAll();
  }

  @Get("assigned")
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: "Get assigned reports for current user",
    description:
      "Retrieves all reports assigned to the authenticated user. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "List of reports assigned to the current user.",
    type: [ReportResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  async getAssignedReports(
    @CurrentUser() user: AuthUser
  ): Promise<ReportResponseDto[]> {
    return this.reportsService.findAssignedByUserId(user.id);
  }

  @Get("completed")
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: "Get completed reports for current user",
    description:
      "Retrieves all completed reports assigned to the authenticated user. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "List of completed reports assigned to the current user.",
    type: [ReportResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  async getCompletedReports(
    @CurrentUser() user: AuthUser
  ): Promise<ReportResponseDto[]> {
    return this.reportsService.findCompletedByUserId(user.id);
  }

  @Get("available")
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: "Get available (unassigned) reports",
    description:
      "Retrieves all reports that are not yet assigned to any user (status: pending). Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "List of available (unassigned) reports.",
    type: [ReportResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  async getAvailableReports(): Promise<ReportResponseDto[]> {
    return this.reportsService.findAvailable();
  }

  @Post(":id/assign")
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Assign a report to the current user",
    description:
      "Assigns a report to the authenticated user. Creates a record in the assigned_reports table and updates the report status to 'assigned'. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Report assigned successfully.",
    type: AssignReportResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Report not found.",
  })
  @ApiResponse({
    status: 409,
    description: "Report is already assigned to this user or another moderator.",
  })
  async assignReportToSelf(
    @Param("id") reportId: string,
    @CurrentUser() user: AuthUser
  ): Promise<AssignReportResponseDto> {
    return this.reportsService.assignReportToUser(reportId, user.id);
  }

  @Delete(":id/assign")
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Unassign a report from the current user",
    description:
      "Unassigns a report that was assigned to the authenticated user. Removes the assignment record and updates the report status to 'pending'. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Report unassigned successfully.",
    type: UnassignReportResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Report not found.",
  })
  @ApiResponse({
    status: 409,
    description: "Report is not assigned to you.",
  })
  async unassignReportFromSelf(
    @Param("id") reportId: string,
    @CurrentUser() user: AuthUser
  ): Promise<UnassignReportResponseDto> {
    return this.reportsService.unassignReportFromUser(reportId, user.id);
  }

  @Patch(":id/review")
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Review and complete a report",
    description:
      "Marks a report as completed. The report must be assigned to the authenticated user. Updates the report status to 'completed' and records the completion time. Requires authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Report reviewed successfully.",
    type: ReviewReportResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid bearer token.",
  })
  @ApiResponse({
    status: 404,
    description: "Report not found.",
  })
  @ApiResponse({
    status: 409,
    description: "Report is not assigned to you.",
  })
  async reviewReport(
    @Param("id") reportId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewReportDto
  ): Promise<ReviewReportResponseDto> {
    return this.reportsService.reviewReport(
      reportId,
      user.id,
      dto
    );
  }
}

