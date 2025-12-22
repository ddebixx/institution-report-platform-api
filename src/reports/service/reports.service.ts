import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { extname } from "path";
import { SupabaseService } from "../../supabase/supabase.service";
import { EmailService } from "../../email/email.service";
import { ModeratorsRepository } from "../../moderators/repository/moderators.repository";
import { ReportsRepository } from "../repository/reports.repository";
import { ReportMapper } from "../repository/report.mapper";
import { CreateReportDto } from "../dto/create-report.dto";
import { CreateReportResponseDto } from "../dto/create-report-response.dto";
import { ReportResponseDto } from "../dto/report-response.dto";
import { AssignReportResponseDto } from "../dto/assign-report-response.dto";
import { UnassignReportResponseDto } from "../dto/unassign-report-response.dto";
import { ReviewReportResponseDto } from "../dto/review-report-response.dto";
import { ReviewReportDto } from "../dto/review-report.dto";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly bucket: string;

  constructor(
    private readonly repository: ReportsRepository,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly moderatorsRepository: ModeratorsRepository
  ) {
    this.bucket = this.config.get<string>("SUPABASE_BUCKET") ?? "report-files";
  }

  async create(
    dto: CreateReportDto,
    pdf: Express.Multer.File | undefined,
    user?: AuthUser
  ): Promise<CreateReportResponseDto> {
    if (!pdf) {
      throw new UnprocessableEntityException("A PDF file is required.");
    }

    const client = this.supabase.getClient();
    let pdfPath: string | undefined;

    const extension = extname(pdf.originalname || "report.pdf") || ".pdf";
    const uniqueId = randomUUID();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateFolder = `${year}-${month}-${day}`;

    const institutionPrefix = dto.institutionId || dto.numerRspo;
    const folderPath = institutionPrefix
      ? `${institutionPrefix}/${dateFolder}`
      : `unassigned/${dateFolder}`;

    const storagePath = `${folderPath}/${uniqueId}${extension}`;

    const { data, error } = await client.storage
      .from(this.bucket)
      .upload(storagePath, pdf.buffer, {
        contentType: pdf.mimetype || "application/pdf",
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload PDF: ${error.message}`
      );
    }

    pdfPath = data.path;

    const institutionId =
      dto.institutionId ||
      dto.numerRspo ||
      dto.reportedInstitution ||
      undefined;

    try {
      const report = await this.repository.create({
        reporter_name: dto.reporterName,
        reporter_email: dto.reporterEmail,
        reported_institution: dto.reportedInstitution,
        report_description: dto.reportDescription,
        report_content: {
          ...dto.reportContent,
          pdf_storage_path: pdfPath,
          numer_rspo: dto.numerRspo,
          submitted_by_user_id: user?.id ?? null,
        },
        institution_name: dto.institutionName,
        institution_id: institutionId,
        report_reason: dto.reportReason,
      });

      return {
        reportId: report.report_id,
        pdfPath,
        institutionId,
      };
    } catch (error) {
      if (pdfPath) {
        await client.storage.from(this.bucket).remove([pdfPath]);
      }
      throw new UnprocessableEntityException(
        `Could not save report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findAll(): Promise<ReportResponseDto[]> {
    try {
      const entities = await this.repository.findAll();
      this.logger.log(`Fetched ${entities.length} reports`);

      if (entities.length > 0) {
        this.logger.debug(
          `First report row keys: ${JSON.stringify(Object.keys(entities[0]))}`
        );
        this.logger.debug(
          `First report row has report_id: ${!!entities[0].report_id}`
        );
      }

      return ReportMapper.toResponseDtos(entities);
    } catch (error) {
      this.logger.error(
        `Error in findAll: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch reports: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findAssignedByUserId(userId: string): Promise<ReportResponseDto[]> {
    try {
      const moderator = await this.repository.findOrCreateModerator(userId);
      const assignments =
        await this.repository.findAssignmentsByModeratorId(moderator.id);

      if (assignments.length === 0) {
        this.logger.log(`No assigned reports found for user ${userId}`);
        return [];
      }

      const reportIds = assignments.map((a) => a.report_id);
      const reports = await this.repository.findByIds(reportIds);

      const assignmentMap = new Map(
        assignments.map((a) => [a.report_id, a])
      );

      const transformedReports = ReportMapper.toResponseDtos(
        reports,
        assignmentMap,
        userId
      );

      const filteredReports = transformedReports.filter(
        (report) => report.status === "assigned"
      );

      this.logger.log(
        `Fetched ${filteredReports.length} assigned reports for user ${userId}`
      );
      return filteredReports;
    } catch (error) {
      this.logger.error(
        `Error in findAssignedByUserId: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch assigned reports: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findCompletedByUserId(userId: string): Promise<ReportResponseDto[]> {
    try {
      const moderator = await this.repository.findOrCreateModerator(userId);
      const assignments =
        await this.repository.findAssignmentsByModeratorId(moderator.id);

      if (assignments.length === 0) {
        this.logger.log(`No assigned reports found for user ${userId}`);
        return [];
      }

      const reportIds = assignments.map((a) => a.report_id);
      const reports = await this.repository.findByIds(reportIds);

      const assignmentMap = new Map(
        assignments.map((a) => [a.report_id, a])
      );

      const transformedReports = ReportMapper.toResponseDtos(
        reports,
        assignmentMap,
        userId
      );

      const completedReports = transformedReports.filter(
        (report) => report.status === "completed"
      );

      this.logger.log(
        `Fetched ${completedReports.length} completed reports for user ${userId}`
      );
      return completedReports;
    } catch (error) {
      this.logger.error(
        `Error in findCompletedByUserId: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch completed reports: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findAvailable(): Promise<ReportResponseDto[]> {
    try {
      const assignedReportIds =
        await this.repository.findAllAssignedReportIds();
      const assignedReportIdsSet = new Set(assignedReportIds);

      const allReports = await this.repository.findAll();

      const availableReports = ReportMapper.toResponseDtos(allReports).filter(
        (report) =>
          !assignedReportIdsSet.has(report.id) &&
          (!report.assignedTo || report.status === "pending")
      );

      this.logger.log(`Fetched ${availableReports.length} available reports`);
      return availableReports;
    } catch (error) {
      this.logger.error(
        `Error in findAvailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to fetch available reports: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async assignReportToUser(
    reportId: string,
    userId: string
  ): Promise<AssignReportResponseDto> {
    try {
      const report = await this.repository.findById(reportId);
      if (!report) {
        this.logger.error(`Report not found: ${reportId}`);
        throw new NotFoundException(`Report with ID ${reportId} not found`);
      }

      const moderator = await this.repository.findOrCreateModerator(userId);
      this.logger.log(`Using moderator ${moderator.id} for user ${userId}`);

      const existingAssignment = await this.repository.findAssignment(
        reportId
      );

      if (existingAssignment) {
        if (existingAssignment.moderator_id !== moderator.id) {
          this.logger.warn(
            `Report ${reportId} is already assigned to another moderator`
          );
          throw new ConflictException(
            "This report is already assigned to another moderator"
          );
        } else {
          this.logger.warn(
            `Report ${reportId} is already assigned to moderator ${moderator.id}`
          );
          throw new ConflictException("This report is already assigned to you");
        }
      }

      const assignedAt = new Date().toISOString();

      try {
        await this.repository.createAssignment(
          reportId,
          moderator.id,
          assignedAt
        );
      } catch (error) {
        this.logger.error(
          `Failed to create assignment: ${error instanceof Error ? error.message : "Unknown error"}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new InternalServerErrorException(
          `Failed to assign report: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      const currentContent =
        (report.report_content as Record<string, unknown>) || {};
      const updatedContent = {
        ...currentContent,
        status: "assigned",
        assigned_to: userId,
        assigned_at: assignedAt,
      };

      try {
        await this.repository.update(reportId, {
          report_content: updatedContent,
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update report status: ${updateError instanceof Error ? updateError.message : "Unknown error"}`,
          updateError instanceof Error ? updateError.stack : undefined
        );

        await this.repository.deleteAssignment(reportId);
        throw new InternalServerErrorException(
          `Failed to update report status: ${updateError instanceof Error ? updateError.message : "Unknown error"}`
        );
      }

      this.logger.log(
        `Successfully assigned report ${reportId} to moderator ${moderator.id} (user ${userId})`
      );

      return {
        message: "Report assigned successfully",
        reportId,
        moderatorId: moderator.id,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(
        `Error in assignReportToUser: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to assign report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async unassignReportFromUser(
    reportId: string,
    userId: string
  ): Promise<UnassignReportResponseDto> {
    try {
      const report = await this.repository.findById(reportId);
      if (!report) {
        this.logger.error(`Report not found: ${reportId}`);
        throw new NotFoundException(`Report with ID ${reportId} not found`);
      }

      const moderator = await this.repository.findOrCreateModerator(userId);
      const existingAssignment = await this.repository.findAssignment(
        reportId,
        moderator.id
      );

      if (!existingAssignment) {
        this.logger.warn(
          `Report ${reportId} is not assigned to moderator ${moderator.id}`
        );
        throw new ConflictException(
          "This report is not assigned to you"
        );
      }

      await this.repository.deleteAssignment(reportId);

      const currentContent =
        (report.report_content as Record<string, unknown>) || {};
      const updatedContent = {
        ...currentContent,
        status: "pending",
        assigned_to: null,
        assigned_at: null,
      };

      try {
        await this.repository.update(reportId, {
          report_content: updatedContent,
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update report status: ${updateError instanceof Error ? updateError.message : "Unknown error"}`,
          updateError instanceof Error ? updateError.stack : undefined
        );
        throw new InternalServerErrorException(
          `Failed to update report status: ${updateError instanceof Error ? updateError.message : "Unknown error"}`
        );
      }

      this.logger.log(
        `Successfully unassigned report ${reportId} from moderator ${moderator.id} (user ${userId})`
      );

      return {
        message: "Report unassigned successfully",
        reportId,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(
        `Error in unassignReportFromUser: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to unassign report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async reviewReport(
    reportId: string,
    userId: string,
    dto: ReviewReportDto
  ): Promise<ReviewReportResponseDto> {
    try {
      const report = await this.repository.findById(reportId);
      if (!report) {
        this.logger.error(`Report not found: ${reportId}`);
        throw new NotFoundException(`Report with ID ${reportId} not found`);
      }

      const moderator = await this.repository.findOrCreateModerator(userId);
      const existingAssignment = await this.repository.findAssignment(
        reportId,
        moderator.id
      );

      if (!existingAssignment) {
        this.logger.warn(
          `Report ${reportId} is not assigned to moderator ${moderator.id}`
        );
        throw new ConflictException(
          "This report is not assigned to you"
        );
      }

      const reviewNotes =
        dto.reportContent?.comparisonNotes?.trim() ||
        dto.reviewNotes?.trim() ||
        null;

      this.logger.debug(
        `AI Extracted review notes for report ${reportId}: ${reviewNotes ? `"${reviewNotes.substring(0, 50)}${reviewNotes.length > 50 ? "..." : ""}"` : "null"}`
      );

      const currentContent =
        (report.report_content as Record<string, unknown>) || {};
      const completedAt = new Date().toISOString();

      const updatedContent = {
        ...currentContent,
        status: "completed",
        completed_at: completedAt,
        review_notes: reviewNotes,
        findings: dto.reportContent?.findings || currentContent.findings,
        comparisonNotes: dto.reportContent?.comparisonNotes || currentContent.comparisonNotes,
      };

      try {
        await this.repository.update(reportId, {
          report_content: updatedContent,
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update report status: ${updateError instanceof Error ? updateError.message : "Unknown error"}`,
          updateError instanceof Error ? updateError.stack : undefined
        );
        throw new InternalServerErrorException(
          `Failed to update report status: ${updateError instanceof Error ? updateError.message : "Unknown error"}`
        );
      }

      this.logger.log(
        `Successfully reviewed report ${reportId} by moderator ${moderator.id} (user ${userId})`
      );

      const moderatorDetails = await this.moderatorsRepository.findById(moderator.id);

      await this.emailService.sendReportReviewEmail({
        report,
        reviewNotes: reviewNotes || undefined,
        moderator: moderatorDetails,
      });

      return {
        message: "Report reviewed successfully",
        reportId,
        status: "completed",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(
        `Error in reviewReport: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to review report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

