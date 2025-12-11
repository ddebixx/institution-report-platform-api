import {
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { extname } from "path";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { CreateReportResponseDto } from "./dto/create-report-response.dto";

@Injectable()
export class ReportsService {
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
      
      const institutionPrefix = dto.institutionId || dto.numerRspo;
      const folderPath = institutionPrefix
        ? `${institutionPrefix}/${year}/${month}/${day}`
        : `unassigned/${year}/${month}/${day}`;
      
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
      .select()
      .single();

    if (insertError) {
      if (pdfPath) {
        await client.storage.from(this.bucket).remove([pdfPath]);
      }

      throw new UnprocessableEntityException(
        `Could not save report: ${insertError.message}`
      );
    }

    return {
      reportId: report.id,
      pdfPath,
      institutionId,
    };
  }
}

