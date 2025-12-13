import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import type {
  ReportEntity,
  AssignedReportEntity,
  ModeratorEntity,
} from "../entities/report.entity";

@Injectable()
export class ReportsRepository {
  private readonly logger = new Logger(ReportsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(): Promise<ReportEntity[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch reports: ${error.message}`, error);
      throw error;
    }

    return (data || []) as ReportEntity[];
  }

  async findById(reportId: string): Promise<ReportEntity | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("reports")
      .select("*")
      .eq("report_id", reportId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch report ${reportId}: ${error.message}`,
        error
      );
      throw error;
    }

    return (data as ReportEntity) || null;
  }

  async findByIds(reportIds: string[]): Promise<ReportEntity[]> {
    if (reportIds.length === 0) {
      return [];
    }

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("reports")
      .select("*")
      .in("report_id", reportIds)
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch reports by IDs: ${error.message}`,
        error
      );
      throw error;
    }

    return (data || []) as ReportEntity[];
  }

  async create(reportData: Partial<ReportEntity>): Promise<ReportEntity> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("reports")
      .insert(reportData)
      .select("*")
      .single();

    if (error) {
      this.logger.error(`Failed to create report: ${error.message}`, error);
      throw error;
    }

    if (!data) {
      throw new Error("Report was created but no data was returned");
    }

    return data as ReportEntity;
  }

  async update(
    reportId: string,
    updateData: Partial<ReportEntity>
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from("reports")
      .update(updateData)
      .eq("report_id", reportId);

    if (error) {
      this.logger.error(
        `Failed to update report ${reportId}: ${error.message}`,
        error
      );
      throw error;
    }
  }

  async findAssignmentsByModeratorId(
    moderatorId: string
  ): Promise<AssignedReportEntity[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("assigned_reports")
      .select("report_id, assigned_at")
      .eq("moderator_id", moderatorId);

    if (error) {
      this.logger.error(
        `Failed to fetch assigned reports: ${error.message}`,
        error
      );
      throw error;
    }

    return (data || []) as AssignedReportEntity[];
  }

  async findAllAssignedReportIds(): Promise<string[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from("assigned_reports")
      .select("report_id");

    if (error) {
      this.logger.error(
        `Failed to fetch assigned report IDs: ${error.message}`,
        error
      );
      throw error;
    }

    return (data || []).map((item) => item.report_id);
  }

  async findAssignment(
    reportId: string,
    moderatorId?: string
  ): Promise<AssignedReportEntity | null> {
    const client = this.supabase.getClient();

    let query = client
      .from("assigned_reports")
      .select("moderator_id, report_id, assigned_at")
      .eq("report_id", reportId);

    if (moderatorId) {
      query = query.eq("moderator_id", moderatorId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch assignment: ${error.message}`,
        error
      );
      throw error;
    }

    return (data as AssignedReportEntity) || null;
  }

  async createAssignment(
    reportId: string,
    moderatorId: string,
    assignedAt: string
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client.from("assigned_reports").insert({
      report_id: reportId,
      moderator_id: moderatorId,
      assigned_at: assignedAt,
    });

    if (error) {
      this.logger.error(
        `Failed to create assignment: ${error.message}`,
        error
      );
      throw error;
    }
  }

  async deleteAssignment(reportId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from("assigned_reports")
      .delete()
      .eq("report_id", reportId);

    if (error) {
      this.logger.error(
        `Failed to delete assignment: ${error.message}`,
        error
      );
      throw error;
    }
  }

  async findOrCreateModerator(userId: string): Promise<ModeratorEntity> {
    const client = this.supabase.getClient();

    const { data: existing, error: findError } = await client
      .from("moderators")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (findError && findError.code !== "PGRST116") {
      this.logger.error(
        `Error fetching moderator: ${findError.message}`,
        findError
      );
      throw findError;
    }

    if (existing) {
      return existing as ModeratorEntity;
    }

    const { data: created, error: createError } = await client
      .from("moderators")
      .insert({ id: userId })
      .select("id")
      .single();

    if (createError) {
      this.logger.error(
        `Failed to create moderator: ${createError.message}`,
        createError
      );
      throw createError;
    }

    if (!created) {
      throw new Error("Moderator was created but no data was returned");
    }

    return created as ModeratorEntity;
  }
}
