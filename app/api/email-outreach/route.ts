import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

type EmailStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "delivered"
  | "replied"
  | "failed";

const VALID_STATUSES: EmailStatus[] = [
  "pending",
  "scheduled",
  "sending",
  "sent",
  "delivered",
  "replied",
  "failed",
];

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  return !Number.isNaN(new Date(value).getTime());
}

function normalizeStatus(value: string | null): EmailStatus {
  return value && VALID_STATUSES.includes(value as EmailStatus)
    ? (value as EmailStatus)
    : "pending";
}

function getBrevoApiKey() {
  return process.env.BREVO_API_KEY;
}

async function getBrevoTemplate(templateId: number) {
  const apiKey = getBrevoApiKey();

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://api.brevo.com/v3/smtp/templates/${templateId}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || "Brevo template could not be loaded."
    );
  }

  return data;
}

function templateSubject(template: any) {
  return String(template?.subject || "");
}

function templateName(template: any) {
  return String(
    template?.name || `Brevo Template ${template?.id ?? ""}`
  );
}

function templateBody(template: any) {
  return String(template?.htmlContent || template?.textContent || "");
}

function templateSender(template: any) {
  const sender = template?.sender;

  return {
    name: String(sender?.name || ""),
    email: String(sender?.email || ""),
    id: sender?.id ?? null,
  };
}

async function getEligibleLeads(leadIds: number[]) {
  return prisma.lead.findMany({
    where: {
      id: { in: leadIds },

      OR: [
        {
          verificationStatus: {
            equals: "verified",
            mode: "insensitive",
          },
        },
        {
          isVerified: true,
        },
      ],

      email: { not: null },
      emailStatus: "pending",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/*
 * GET
 *
 * Supported:
 * /api/email-outreach?status=pending
 * /api/email-outreach?status=scheduled
 * /api/email-outreach?status=sent
 * /api/email-outreach?status=delivered
 * /api/email-outreach?status=replied
 * /api/email-outreach?status=failed
 *
 * /api/email-outreach?resource=counts
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get("resource");

    /*
     * Lifecycle counts.
     *
     * A lead is considered verified when either:
     * - verificationStatus = "verified", OR
     * - isVerified = true
     *
     * This keeps the Email Outreach page aligned with the
     * verification state already used by the Leads section.
     */
    if (resource === "counts") {
      const countResults = await Promise.all(
        VALID_STATUSES.map(async (emailStatus) => {
          const count = await prisma.lead.count({
            where: {
              OR: [
                {
                  verificationStatus: {
                    equals: "verified",
                    mode: "insensitive",
                  },
                },
                {
                  isVerified: true,
                },
              ],

              email: {
                not: null,
              },

              emailStatus,
            },
          });

          return [emailStatus, count] as const;
        })
      );

      const counts = Object.fromEntries(countResults) as Record<
        EmailStatus,
        number
      >;

      return NextResponse.json({
        success: true,
        counts,
      });
    }

    /*
     * Leads by lifecycle status.
     */
    const status = normalizeStatus(searchParams.get("status"));

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          {
            verificationStatus: {
              equals: "verified",
              mode: "insensitive",
            },
          },
          {
            isVerified: true,
          },
        ],

        email: {
          not: null,
        },

        emailStatus: status,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      status,
      leads,
      total: leads.length,
    });
  } catch (error) {
    console.error("GET /api/email-outreach error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch email outreach data.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * POST
 *
 * Actions:
 * - schedule
 * - send-now
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action !== "schedule" && action !== "send-now") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action. Use schedule or send-now.",
        },
        {
          status: 400,
        }
      );
    }

    const leadIds = parseIds(body?.leadIds);

    if (!leadIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Select at least one lead.",
        },
        {
          status: 400,
        }
      );
    }

    const templateId = Number(body?.templateId);

    if (!Number.isInteger(templateId) || templateId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid Brevo template is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Brevo template is the source of truth for:
     * - template name
     * - subject
     * - HTML body
     * - sender
     */
    const template = await getBrevoTemplate(templateId);
    const leads = await getEligibleLeads(leadIds);

    if (!leads.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No selected leads are eligible for outreach.",
        },
        {
          status: 400,
        }
      );
    }

    const subject = templateSubject(template);
    const bodyHtml = templateBody(template);
    const name = templateName(template);
    const sender = templateSender(template);

    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected Brevo template has no subject.",
        },
        {
          status: 400,
        }
      );
    }

    if (!sender.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected Brevo template has no sender email.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * SCHEDULE
     */
    if (action === "schedule") {
      if (!validDate(body?.scheduledAt)) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid future date and time is required.",
          },
          {
            status: 400,
          }
        );
      }

      const scheduledAt = new Date(body.scheduledAt);

      if (scheduledAt <= new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: "Scheduled date and time must be in the future.",
          },
          {
            status: 400,
          }
        );
      }

      const result = await prisma.lead.updateMany({
        where: {
          id: {
            in: leads.map((lead) => lead.id),
          },

          OR: [
            {
              verificationStatus: {
                equals: "verified",
                mode: "insensitive",
              },
            },
            {
              isVerified: true,
            },
          ],

          email: {
            not: null,
          },

          emailStatus: "pending",
        },

        data: {
          emailStatus: "scheduled",
          emailScheduledAt: scheduledAt,

          emailSentAt: null,
          emailDeliveredAt: null,
          emailOpenedAt: null,
          emailClickedAt: null,
          emailRepliedAt: null,

          emailError: null,
          emailMessageId: null,

          emailTemplateName: name,
          emailSubject: subject,
          emailBody: bodyHtml,

          emailSenderName: sender.name || null,
          emailSenderAddress: sender.email,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} email(s) scheduled successfully.`,
        scheduledCount: result.count,
        scheduledAt: scheduledAt.toISOString(),
      });
    }

    /*
     * SEND NOW
     */
    const webhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "N8N_EMAIL_WEBHOOK_URL is not configured. Send Now is currently unavailable.",
        },
        {
          status: 500,
        }
      );
    }

    let queuedCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      /*
       * Mark as sending BEFORE sending to n8n.
       * This prevents duplicate selection.
       */
      await prisma.lead.update({
        where: {
          id: lead.id,
        },

        data: {
          emailStatus: "sending",

          emailScheduledAt: null,
          emailSentAt: null,
          emailDeliveredAt: null,
          emailOpenedAt: null,
          emailClickedAt: null,
          emailRepliedAt: null,

          emailError: null,
          emailMessageId: null,

          emailTemplateName: name,
          emailSubject: subject,
          emailBody: bodyHtml,

          emailSenderName: sender.name || null,
          emailSenderAddress: sender.email,
        },
      });

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            leadId: lead.id,
            toEmail: lead.email,
            website: lead.website,

            templateId,
            templateName: name,

            subject,

            senderName: sender.name || null,
            senderEmail: sender.email,
            senderId: sender.id,

            params: {
              companyName: lead.website,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`n8n returned HTTP ${response.status}`);
        }

        queuedCount++;
      } catch (error) {
        failedCount++;

        await prisma.lead.update({
          where: {
            id: lead.id,
          },

          data: {
            emailStatus: "failed",
            emailError:
              error instanceof Error
                ? error.message
                : "Failed to queue email.",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${queuedCount} email(s) queued successfully.`,
      queuedCount,
      failedCount,
      totalSelected: leads.length,
    });
  } catch (error) {
    console.error("POST /api/email-outreach error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Email outreach request failed.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * PATCH
 *
 * Used mainly by:
 * - n8n
 * - Brevo webhook
 * - future reply integration
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const leadIds = parseIds(body?.leadIds);

    if (!leadIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid lead IDs are required.",
        },
        {
          status: 400,
        }
      );
    }

    const status = body?.status as EmailStatus;

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email status.",
        },
        {
          status: 400,
        }
      );
    }

    const data: Record<string, unknown> = {
      emailStatus: status,
    };

    if (status === "sent") {
      data.emailSentAt = validDate(body?.sentAt)
        ? new Date(body.sentAt)
        : new Date();

      data.emailError = null;

      if (
        typeof body?.messageId === "string" &&
        body.messageId.trim()
      ) {
        data.emailMessageId = body.messageId.trim();
      }
    }

    if (status === "delivered") {
      data.emailDeliveredAt = validDate(body?.deliveredAt)
        ? new Date(body.deliveredAt)
        : new Date();

      data.emailError = null;

      if (
        typeof body?.messageId === "string" &&
        body.messageId.trim()
      ) {
        data.emailMessageId = body.messageId.trim();
      }
    }

    if (status === "replied") {
      data.emailRepliedAt = validDate(body?.repliedAt)
        ? new Date(body.repliedAt)
        : new Date();

      data.emailError = null;
    }

    if (status === "failed") {
      data.emailError =
        typeof body?.error === "string" && body.error.trim()
          ? body.error.trim()
          : "Email sending failed.";
    }

    if (validDate(body?.openedAt)) {
      data.emailOpenedAt = new Date(body.openedAt);
    }

    if (validDate(body?.clickedAt)) {
      data.emailClickedAt = new Date(body.clickedAt);
    }

    if (
      typeof body?.messageId === "string" &&
      body.messageId.trim()
    ) {
      data.emailMessageId = body.messageId.trim();
    }

    const result = await prisma.lead.updateMany({
      where: {
        id: {
          in: leadIds,
        },

        OR: [
          {
            verificationStatus: {
              equals: "verified",
              mode: "insensitive",
            },
          },
          {
            isVerified: true,
          },
        ],

        email: {
          not: null,
        },
      },

      data,
    });

    return NextResponse.json({
      success: true,
      message: "Email status updated successfully.",
      updatedCount: result.count,
      status,
    });
  } catch (error) {
    console.error("PATCH /api/email-outreach error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update email status.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * DELETE
 *
 * Cancel scheduled emails.
 *
 * scheduled → pending
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const leadIds = parseIds(body?.leadIds);

    if (!leadIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one lead ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const result = await prisma.lead.updateMany({
      where: {
        id: {
          in: leadIds,
        },

        OR: [
          {
            verificationStatus: {
              equals: "verified",
              mode: "insensitive",
            },
          },
          {
            isVerified: true,
          },
        ],

        email: {
          not: null,
        },

        emailStatus: "scheduled",
      },

      data: {
        emailStatus: "pending",
        emailScheduledAt: null,
        emailError: null,
        emailTemplateName: null,
        emailSubject: null,
        emailBody: null,
        emailSenderName: null,
        emailSenderAddress: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} scheduled email(s) cancelled.`,
      cancelledCount: result.count,
    });
  } catch (error) {
    console.error("DELETE /api/email-outreach error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to cancel scheduled email.",
      },
      {
        status: 500,
      }
    );
  }
}