import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { ReportEntity } from "../reports/entities/report.entity";
import { ModeratorEntity } from "../moderators/entities/moderator.entity";

interface SendReportReviewEmailParams {
  report: ReportEntity;
  reviewNotes?: string;
  moderator?: ModeratorEntity | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");
    this.fromEmail =
      this.configService.get<string>("RESEND_FROM_EMAIL") ??
      "huddle@huddle.net.pl";

    if (!apiKey) {
      this.logger.error(
        "Missing RESEND_API_KEY environment variable. Email sending is disabled."
      );
      throw new InternalServerErrorException(
        "Email service is not configured correctly."
      );
    }

    this.resend = new Resend(apiKey);
  }

  async sendReportReviewEmail(
    params: SendReportReviewEmailParams
  ): Promise<void> {
    const { report, reviewNotes, moderator } = params;

    if (!report.reporter_email) {
      this.logger.warn(
        "Skipping report review email because reporter_email is missing."
      );
      return;
    }

    const subject = "Your report has been reviewed";

    const institutionName =
      report.institution_name ?? report.reported_institution ?? "your institution";

    const safeReviewNotes =
      reviewNotes && reviewNotes.trim().length > 0
        ? reviewNotes.trim()
        : "The moderator has completed the review of your report.";

    const moderatorName = moderator?.fullname || "our team";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Review Completed</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-collapse: collapse;">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 32px 40px; background-color: #1a1a1a; border-bottom: 3px solid #2563eb;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; line-height: 1.4; letter-spacing: -0.5px;">
                      Report Review Notification
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                      Dear ${this.escapeHtml(report.reporter_name || "Reporter")},
                    </p>
                    <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.7; color: #333333;">
                      We are writing to inform you that your report concerning <strong style="color: #1a1a1a;">${this.escapeHtml(institutionName)}</strong> has been reviewed by ${this.escapeHtml(moderatorName)}.
                    </p>
                    
                    <!-- Summary Box -->
                    <div style="background-color: #fafafa; border: 1px solid #e0e0e0; padding: 24px; margin: 28px 0;">
                      <p style="margin: 0 0 14px 0; font-size: 13px; font-weight: 600; color: #555555; text-transform: uppercase; letter-spacing: 1px;">
                        Review Summary
                      </p>
                      <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #1a1a1a; white-space: pre-line;">
                        ${this.escapeHtml(safeReviewNotes)}
                      </p>
                    </div>
                    
                    <!-- Report Details -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 28px 0;">
                      <tr>
                        <td style="padding: 16px; background-color: #fafafa; border: 1px solid #e0e0e0;">
                          <p style="margin: 0; font-size: 13px; color: #555555;">
                            <strong style="color: #1a1a1a;">Report Reference ID:</strong>
                          </p>
                          <p style="margin: 8px 0 0 0; font-family: 'Courier New', monospace; font-size: 14px; color: #1a1a1a;">
                            ${report.report_id}
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 28px 0 0 0; font-size: 15px; line-height: 1.7; color: #555555;">
                      We appreciate your contribution to maintaining institutional compliance and transparency.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #888888; text-align: center;">
                      This is an automated notification. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: report.reporter_email,
        subject,
        html,
      });

      this.logger.log(
        `Report review email sent successfully to ${report.reporter_email} for report ${report.report_id}.`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send report review email for report ${report.report_id}: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

