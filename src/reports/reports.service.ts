import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { extname } from "path";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { CreateReportResponseDto } from "./dto/create-report-response.dto";
import { ReportResponseDto } from "./dto/report-response.dto";
import { AssignReportResponseDto } from "./dto/assign-report-response.dto";
import { NotFoundException, ConflictException } from "@nestjs/common";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly bucket: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {
    this.bucket = this.config.get<string>("SUPABASE_BUCKET") ?? "report-files";
  }

  async create(
    dto: CreateReportDto,
    pdf: Express.Multer.File | undefined,
    user?: AuthUser
  ): Promise<CreateReportResponseDto> {
    const client = this.supabase.getClient();
    let pdfPath: string | undefined;

    if (!pdf) {
      throw new UnprocessableEntityException("A PDF file is required.");
    }

    if (pdf) {
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
    }

    const institutionId =
      dto.institutionId ||
      dto.numerRspo ||
      dto.reportedInstitution ||
      undefined;

    const { data: report, error: insertError } = await client
      .from("reports")
      .insert({
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
      })
      .select("id")
      .single();

    if (insertError) {
      if (pdfPath) {
        await client.storage.from(this.bucket).remove([pdfPath]);
      }

      throw new UnprocessableEntityException(
        `Could not save report: ${insertError.message}`
      );
    }

    if (!report?.id) {
      throw new InternalServerErrorException(
        "Report was created but no ID was returned"
      );
    }

    return {
      reportId: report.id,
      pdfPath,
      institutionId,
    };
  }

  private transformReport(row: any): ReportResponseDto {
    try {
      const reportContent = (row.report_content as Record<string, unknown>) || {};
      const pdfPath = reportContent.pdf_storage_path as string | undefined;

      let status: "pending" | "assigned" | "completed" = "pending";
      if (
        reportContent.status &&
        ["pending", "assigned", "completed"].includes(
          reportContent.status as string
        )
      ) {
        status = reportContent.status as "pending" | "assigned" | "completed";
      } else if (row.status && ["pending", "assigned", "completed"].includes(row.status)) {
        status = row.status;
      }

      const assignedTo =
        (reportContent.assigned_to as string) || row.assigned_to || undefined;

      const parseDate = (dateValue: unknown): string | undefined => {
        if (!dateValue) return undefined;
        try {
          const date = new Date(dateValue as string);
          if (isNaN(date.getTime())) return undefined;
          return date.toISOString();
        } catch {
          return undefined;
        }
      };

      const assignedAt =
        parseDate(reportContent.assigned_at) || parseDate(row.assigned_at);
      const completedAt =
        parseDate(reportContent.completed_at) || parseDate(row.completed_at);

      const createdAt = row.created_at
        ? parseDate(row.created_at) || new Date().toISOString()
        : new Date().toISOString();
      const updatedAt = row.updated_at
        ? parseDate(row.updated_at) || new Date().toISOString()
        : new Date().toISOString();

      return {
        id: row.id || "",
        reporterName: row.reporter_name || "",
        reporterEmail: row.reporter_email || "",
        reportedInstitution: row.reported_institution || undefined,
        institutionName: row.institution_name || undefined,
        institutionId: row.institution_id || undefined,
        numerRspo:
          (reportContent.numer_rspo as string) || row.numer_rspo || undefined,
        reportDescription: row.report_description || undefined,
        reportReason: row.report_reason || undefined,
        status,
        assignedTo,
        assignedAt,
        completedAt,
        createdAt,
        updatedAt,
        pdfPath,
      };
    } catch (error) {
      this.logger.error(
        `Error transforming report row: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new InternalServerErrorException(
        `Failed to transform report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async findAll(): Promise<ReportResponseDto[]> {
    try {
      const client = this.supabase.getClient();

      const { data, error } = await client
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        this.logger.error(`Failed to fetch reports: ${error.message}`, error);
        throw new InternalServerErrorException(
          `Failed to fetch reports: ${error.message}`
        );
      }

      this.logger.log(`Fetched ${data?.length || 0} reports`);
      return (data || []).map((row) => this.transformReport(row));
    } catch (error) {
      this.logger.error(
        `Error in findAll: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  private async getModeratorIdByUserId(
    client: any,
    userId: string
  ): Promise<string | null> {
    const { data: moderator, error } = await client
      .from("moderators")
      .select("id")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      this.logger.error(
        `Error fetching moderator: ${error.message}`,
        error
      );
      return null;
    }

    return moderator?.id || null;
  }

  async findAssignedByUserId(userId: string): Promise<ReportResponseDto[]> {
    try {
      const client = this.supabase.getClient();

      const moderatorId = await this.getModeratorIdByUserId(client, userId);
      if (!moderatorId) {
        this.logger.log(`No moderator found for user ${userId}`);
        return [];
      }

      const { data: assignments, error: assignmentError } = await client
        .from("assigned_reports")
        .select("report_id, assigned_at")
        .eq("moderator_id", moderatorId);

      if (assignmentError) {
        this.logger.error(
          `Failed to fetch assignments: ${assignmentError.message}`,
          assignmentError
        );
        throw new InternalServerErrorException(
          `Failed to fetch assignments: ${assignmentError.message}`
        );
      }

      if (!assignments || assignments.length === 0) {
        this.logger.log(`No assigned reports found for user ${userId}`);
        return [];
      }

      const reportIds = assignments.map((a) => a.report_id);

      const { data: reports, error: reportsError } = await client
        .from("reports")
        .select("*")
        .in("id", reportIds)
        .order("created_at", { ascending: false });

      if (reportsError) {
        this.logger.error(
          `Failed to fetch reports: ${reportsError.message}`,
          reportsError
        );
        throw new InternalServerErrorException(
          `Failed to fetch reports: ${reportsError.message}`
        );
      }

      const assignmentMap = new Map(
        assignments.map((a) => [a.report_id, a.assigned_at])
      );

      const transformedReports = (reports || []).map((row) => {
        const report = this.transformReport(row);
        const assignedAtFromTable = assignmentMap.get(row.id);
        
        if (assignedAtFromTable && !report.assignedAt) {
          report.assignedAt = new Date(assignedAtFromTable).toISOString();
        }

        if (!report.assignedTo) {
          report.assignedTo = userId;
        }
        return report;
      });

      const filteredReports = transformedReports.filter(
        (report) =>
          report.status === "assigned" || report.status === "completed"
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
      throw error;
    }
  }

  async findCompletedByUserId(userId: string): Promise<ReportResponseDto[]> {
    try {
      const client = this.supabase.getClient();

      const moderatorId = await this.getModeratorIdByUserId(client, userId);
      if (!moderatorId) {
        this.logger.log(`No moderator found for user ${userId}`);
        return [];
      }

      const { data: assignments, error: assignmentError } = await client
        .from("assigned_reports")
        .select("report_id, assigned_at")
        .eq("moderator_id", moderatorId);

      if (assignmentError) {
        this.logger.error(
          `Failed to fetch assignments: ${assignmentError.message}`,
          assignmentError
        );
        throw new InternalServerErrorException(
          `Failed to fetch assignments: ${assignmentError.message}`
        );
      }

      if (!assignments || assignments.length === 0) {
        this.logger.log(`No assigned reports found for user ${userId}`);
        return [];
      }

      const reportIds = assignments.map((a) => a.report_id);

      const { data: reports, error: reportsError } = await client
        .from("reports")
        .select("*")
        .in("id", reportIds)
        .order("created_at", { ascending: false });

      if (reportsError) {
        this.logger.error(
          `Failed to fetch reports: ${reportsError.message}`,
          reportsError
        );
        throw new InternalServerErrorException(
          `Failed to fetch reports: ${reportsError.message}`
        );
      }

      const assignmentMap = new Map(
        assignments.map((a) => [a.report_id, a.assigned_at])
      );

      const transformedReports = (reports || []).map((row) => {
        const report = this.transformReport(row);
        const assignedAtFromTable = assignmentMap.get(row.id);
        
        if (assignedAtFromTable && !report.assignedAt) {
          report.assignedAt = new Date(assignedAtFromTable).toISOString();
        }
        
        if (!report.assignedTo) {
          report.assignedTo = userId;
        }
        
        return report;
      });

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
      throw error;
    }
  }

  async findAvailable(): Promise<ReportResponseDto[]> {
    try {
      const client = this.supabase.getClient();

      const { data: assignments, error: assignmentError } = await client
        .from("assigned_reports")
        .select("report_id");

      if (assignmentError) {
        this.logger.error(
          `Failed to fetch assignments: ${assignmentError.message}`,
          assignmentError
        );
        throw new InternalServerErrorException(
          `Failed to fetch assignments: ${assignmentError.message}`
        );
      }

      const assignedReportIds = new Set(
        (assignments || []).map((a) => a.report_id)
      );

      const { data: allReports, error: reportsError } = await client
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (reportsError) {
        this.logger.error(
          `Failed to fetch reports: ${reportsError.message}`,
          reportsError
        );
        throw new InternalServerErrorException(
          `Failed to fetch reports: ${reportsError.message}`
        );
      }

      const availableReports = (allReports || [])
        .map((row) => this.transformReport(row))
        .filter(
          (report) =>
            !assignedReportIds.has(report.id) &&
            (!report.assignedTo || report.status === "pending")
        );

      this.logger.log(`Fetched ${availableReports.length} available reports`);
      return availableReports;
    } catch (error) {
      this.logger.error(
        `Error in findAvailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  async assignReportToUser(
    reportId: string,
    userId: string
  ): Promise<AssignReportResponseDto> {
    try {
      const client = this.supabase.getClient();

      const { data: report, error: reportError } = await client
        .from("reports")
        .select("id, report_content")
        .eq("id", reportId)
        .single();

      if (reportError || !report) {
        this.logger.error(
          `Report not found: ${reportId}`,
          reportError
        );
        throw new NotFoundException(`Report with ID ${reportId} not found`);
      }

      let moderatorId: string;
      const { data: existingModerator, error: moderatorCheckError } = await client
        .from("moderators")
        .select("id")
        .eq("id", userId)
        .single();

      if (moderatorCheckError && moderatorCheckError.code !== "PGRST116") {
        this.logger.error(
          `Error checking moderator: ${moderatorCheckError.message}`,
          moderatorCheckError
        );
        
        throw new InternalServerErrorException(
          `Failed to check moderator: ${moderatorCheckError.message}`
        );
      }

      if (existingModerator) {
        moderatorId = existingModerator.id;
        this.logger.log(`Found existing moderator ${moderatorId} for user ${userId}`);
      } else {
        const { data: newModerator, error: createModeratorError } = await client
          .from("moderators")
          .insert({
            id: userId,
          })
          .select("id")
          .single();

        if (createModeratorError || !newModerator) {
          this.logger.error(
            `Failed to create moderator: ${createModeratorError?.message || "Unknown error"}`,
            createModeratorError
          );
          throw new InternalServerErrorException(
            `Failed to create moderator record: ${createModeratorError?.message || "Unknown error"}`
          );
        }

        moderatorId = newModerator.id;
        this.logger.log(`Created new moderator ${moderatorId} for user ${userId}`);
      }

      const { data: otherAssignment } = await client
        .from("assigned_reports")
        .select("moderator_id")
        .eq("report_id", reportId)
        .single();

      if (otherAssignment && otherAssignment.moderator_id !== moderatorId) {
        this.logger.warn(
          `Report ${reportId} is already assigned to another moderator`
        );
        throw new ConflictException(
          "This report is already assigned to another moderator"
        );
      }

      const { data: existingAssignmentForModerator } = await client
        .from("assigned_reports")
        .select("moderator_id, report_id")
        .eq("report_id", reportId)
        .eq("moderator_id", moderatorId)
        .single();

      if (existingAssignmentForModerator) {
        this.logger.warn(
          `Report ${reportId} is already assigned to moderator ${moderatorId}`
        );
        throw new ConflictException(
          "This report is already assigned to you"
        );
      }

      const assignedAt = new Date().toISOString();
      const { error: assignError } = await client
        .from("assigned_reports")
        .insert({
          report_id: reportId,
          moderator_id: moderatorId,
          assigned_at: assignedAt,
        });

      if (assignError) {
        this.logger.error(
          `Failed to create assignment: ${assignError.message}`,
          assignError
        );
        throw new InternalServerErrorException(
          `Failed to assign report: ${assignError.message}`
        );
      }

      const currentContent = (report.report_content as Record<string, unknown>) || {};
      const updatedContent = {
        ...currentContent,
        status: "assigned",
        assigned_to: userId,
        assigned_at: assignedAt,
      };

      const { error: updateError } = await client
        .from("reports")
        .update({
          report_content: updatedContent,
        })
        .eq("id", reportId);

      if (updateError) {
        this.logger.error(
          `Failed to update report status: ${updateError.message}`,
          updateError
        );
        
        await client
          .from("assigned_reports")
          .delete()
          .eq("report_id", reportId);
        throw new InternalServerErrorException(
          `Failed to update report status: ${updateError.message}`
        );
      }

      this.logger.log(
        `Successfully assigned report ${reportId} to moderator ${moderatorId} (user ${userId})`
      );

      return {
        message: "Report assigned successfully",
        reportId,
        moderatorId,
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
}