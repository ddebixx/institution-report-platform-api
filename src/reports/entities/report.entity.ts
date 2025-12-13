export type ReportStatus = "pending" | "assigned" | "completed";

export interface ReportEntity {
  report_id: string;
  reporter_name: string;
  reporter_email: string;
  reported_institution?: string | null;
  report_description?: string | null;
  report_content: Record<string, unknown>;
  institution_name?: string | null;
  institution_id?: string | null;
  report_reason?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AssignedReportEntity {
  report_id: string;
  moderator_id: string;
  assigned_at: Date | string;
}

export interface ModeratorEntity {
  id: string;
}

