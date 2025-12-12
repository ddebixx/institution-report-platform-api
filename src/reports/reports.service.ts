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

  async findAssignedByUserId(userId: string): Promise<ReportResponseDto[]> {
    try {
      const client = this.supabase.getClient();

      const { data, error } = await client
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        this.logger.error(
          `Failed to fetch assigned reports: ${error.message}`,
          error
        );
        throw new InternalServerErrorException(
          `Failed to fetch assigned reports: ${error.message}`
        );
      }

      const reports = (data || [])
        .map((row) => this.transformReport(row))
        .filter(
          (report) =>
            report.assignedTo === userId &&
            (report.status === "assigned" || report.status === "completed")
        );

      this.logger.log(
        `Fetched ${reports.length} assigned reports for user ${userId}`
      );
      return reports;
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

      const { data, error } = await client
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        this.logger.error(
          `Failed to fetch completed reports: ${error.message}`,
          error
        );
        throw new InternalServerErrorException(
          `Failed to fetch completed reports: ${error.message}`
        );
      }

      const reports = (data || [])
        .map((row) => this.transformReport(row))
        .filter(
          (report) =>
            report.assignedTo === userId && report.status === "completed"
        );

      this.logger.log(
        `Fetched ${reports.length} completed reports for user ${userId}`
      );
      return reports;
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

      const { data, error } = await client
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        this.logger.error(
          `Failed to fetch available reports: ${error.message}`,
          error
        );
        throw new InternalServerErrorException(
          `Failed to fetch available reports: ${error.message}`
        );
      }

      const reports = (data || [])
        .map((row) => this.transformReport(row))
        .filter((report) => !report.assignedTo && report.status === "pending");

      this.logger.log(`Fetched ${reports.length} available reports`);
      return reports;
    } catch (error) {
      this.logger.error(
        `Error in findAvailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}