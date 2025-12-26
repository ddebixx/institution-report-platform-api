import type { ReportEntity, AssignedReportEntity } from "../entities/report.entity";
import type { ReportResponseDto } from "../dto/report-response.dto";

export class ReportMapper {
  static toResponseDto(
    entity: ReportEntity,
    assignment?: AssignedReportEntity,
    assignedUserId?: string
  ): ReportResponseDto {
    const reportContent =
      (entity.report_content as Record<string, unknown>) || {};
    const pdfPath = reportContent.pdf_storage_path as string | undefined;

    let status: "pending" | "assigned" | "completed" = "pending";
    if (
      reportContent.status &&
      ["pending", "assigned", "completed"].includes(
        reportContent.status as string
      )
    ) {
      status = reportContent.status as "pending" | "assigned" | "completed";
    }

    const assignedTo =
      (reportContent.assigned_to as string) || assignedUserId || undefined;

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
      parseDate(reportContent.assigned_at) ||
      (assignment ? parseDate(assignment.assigned_at) : undefined) ||
      undefined;

    const completedAt = parseDate(reportContent.completed_at) || undefined;

    const createdAt = entity.created_at
      ? parseDate(entity.created_at) || new Date().toISOString()
      : new Date().toISOString();

    const updatedAt = entity.updated_at
      ? parseDate(entity.updated_at) || new Date().toISOString()
      : new Date().toISOString();

    return {
      id: entity.report_id || "",
      reporterName: entity.reporter_name || "",
      reporterEmail: entity.reporter_email || "",
      reportedInstitution: entity.reported_institution || undefined,
      institutionName: entity.institution_name || undefined,
      institutionId: entity.institution_id || undefined,
      numerRspo:
        (reportContent.numer_rspo as string) || undefined,
      reportDescription: entity.report_description || undefined,
      reportReason: entity.report_reason || undefined,
      status,
      assignedTo,
      assignedAt,
      completedAt,
      createdAt,
      updatedAt,
      pdfPath,
    };
  }

  static toResponseDtos(
    entities: ReportEntity[],
    assignmentMap?: Map<string, AssignedReportEntity>,
    assignedUserId?: string
  ): ReportResponseDto[] {
    return entities.map((entity) => {
      const assignment = assignmentMap?.get(entity.report_id);
      return this.toResponseDto(entity, assignment, assignedUserId);
    });
  }
}

