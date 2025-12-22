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
        "AI Missing RESEND_API_KEY environment variable. Email sending is disabled."
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
        "AI Skipping report review email because reporter_email is missing."
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
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-collapse: collapse;">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; line-height: 1.3;">
                      Report Review Completed
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #111827;">
                      Hello ${this.escapeHtml(report.reporter_name || "Reporter")},
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Your report regarding <strong style="color: #111827;">${this.escapeHtml(institutionName)}</strong> has been reviewed by ${this.escapeHtml(moderatorName)}.
                    </p>
                    
                    <!-- Summary Box -->
                    <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px; margin: 24px 0;">
                      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">
                        Summary from Moderator
                      </p>
                      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #111827; white-space: pre-line;">
                        ${this.escapeHtml(safeReviewNotes)}
                      </p>
                    </div>
                    
                    <!-- Report Details -->
                    <div style="background-color: #f9fafb; padding: 16px; border-radius: 4px; margin: 24px 0;">
                      <p style="margin: 0; font-size: 14px; color: #6b7280;">
                        <strong style="color: #374151;">Report ID:</strong>
                        <span style="font-family: 'Courier New', monospace; color: #111827; margin-left: 8px;">${report.report_id}</span>
                      </p>
                    </div>
                    
                    <p style="margin: 24px 0 0 0; font-size: 15px; line-height: 1.6; color: #6b7280;">
                      Thank you for helping us monitor and improve compliance.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                      This is an automated message. Please do not reply to this email.
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
        `AI Report review email sent successfully to ${report.reporter_email} for report ${report.report_id}.`
      );
    } catch (error) {
      this.logger.error(
        `AI Failed to send report review email for report ${report.report_id}: ${error instanceof Error ? error.message : "Unknown error"
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

