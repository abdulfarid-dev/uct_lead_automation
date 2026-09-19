import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

type EmailStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";

const FIXED_SENDER_EMAIL = "farid995576@gmail.com";

const VALID_STATUSES: EmailStatus[] = [
  "pending",
  "scheduled",
  "sending",
  "sent",
  "failed",
];

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((id) => Number(id))
        .filter(
          (id) => Number.isInteger(id) && id > 0
        )
    ),
  ];
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function normalizeStatus(
  value: string | null
): EmailStatus {
  if (
    value &&
    VALID_STATUSES.includes(value as EmailStatus)
  ) {
    return value as EmailStatus;
  }

  return "pending";
}

function personalize(
  text: string,
  lead: {
    email: string | null;
    website: string;
    location: string | null;
  }
) {
  /*
   * Company name is intentionally not shown in the
   * current Lead table/schema.
   *
   * If a future companyName field is added, replace
   * this value with lead.companyName.
   */
  const companyName =
    lead.website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0];

  return text
    .replace(
      /\{\{\s*company_name\s*\}\}/gi,
      companyName
    )
    .replace(
      /\{\{\s*email\s*\}\}/gi,
      lead.email || ""
    )
    .replace(
      /\{\{\s*website\s*\}\}/gi,
      lead.website
    )
    .replace(
      /\{\{\s*location\s*\}\}/gi,
      lead.location || ""
    );
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| Leads:
| /api/email-outreach?status=pending
|
| Senders:
| /api/email-outreach?resource=senders
|--------------------------------------------------------------------------
*/

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const resource = searchParams.get("resource");

    /*
     * SENDERS
     */
    if (resource === "senders") {
      const senders = await prisma.emailSender.findMany({
        where: {
          isActive: true,
          email: FIXED_SENDER_EMAIL,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json({
        success: true,
        senders,
        total: senders.length,
        fixedSenderEmail: FIXED_SENDER_EMAIL,
      });
    }

    /*
     * LEADS
     */
    const status = normalizeStatus(
      searchParams.get("status")
    );

    const leads = await prisma.lead.findMany({
      where: {
        verificationStatus: "verified",
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
    console.error(
      "GET /api/email-outreach error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch email outreach data.",
      },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| action: create-sender
|
| OR
|
| action: schedule
|
| OR
|
| action: send-now
|--------------------------------------------------------------------------
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const action = body?.action;

    /*
     * CREATE SENDER
     */
    if (action === "create-sender") {
      const name =
        typeof body?.name === "string"
          ? body.name.trim()
          : "";

      const email =
        typeof body?.email === "string"
          ? body.email.trim().toLowerCase()
          : "";

      if (!name || !email) {
        return NextResponse.json(
          {
            success: false,
            error: "Sender name and email are required.",
          },
          { status: 400 }
        );
      }

      if (email !== FIXED_SENDER_EMAIL) {
        return NextResponse.json(
          {
            success: false,
            error: `Only ${FIXED_SENDER_EMAIL} can be used as the sender.`,
          },
          { status: 400 }
        );
      }

      const existing =
        await prisma.emailSender.findUnique({
          where: { email: FIXED_SENDER_EMAIL },
        });

      if (existing) {
        if (!existing.isActive) {
          const sender =
            await prisma.emailSender.update({
              where: { id: existing.id },
              data: {
                name,
                isActive: true,
              },
            });

          return NextResponse.json({
            success: true,
            message: "Fixed sender activated successfully.",
            sender,
          });
        }

        return NextResponse.json({
          success: true,
          message: "Fixed sender already exists.",
          sender: existing,
        });
      }

      const sender =
        await prisma.emailSender.create({
          data: {
            name,
            email: FIXED_SENDER_EMAIL,
            isActive: true,
          },
        });

      return NextResponse.json(
        {
          success: true,
          message: "Fixed sender created successfully.",
          sender,
        },
        { status: 201 }
      );
    }

    /*
     * COMMON DATA
     */
    const leadIds = parseIds(body?.leadIds);

    if (leadIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Select at least one lead.",
        },
        { status: 400 }
      );
    }

    const templateId = Number(body?.templateId);

    if (
      !Number.isInteger(templateId) ||
      templateId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid email template is required.",
        },
        { status: 400 }
      );
    }

    const template =
      await prisma.emailTemplate.findFirst({
        where: {
          id: templateId,
          isActive: true,
        },
      });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected email template was not found.",
        },
        { status: 404 }
      );
    }

    const sender =
      await prisma.emailSender.findFirst({
        where: {
          email: FIXED_SENDER_EMAIL,
          isActive: true,
        },
      });

    if (!sender) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Fixed sender ${FIXED_SENDER_EMAIL} is not configured in EmailSender.`,
        },
        { status: 400 }
      );
    }

    const leads = await prisma.lead.findMany({
      where: {
        id: {
          in: leadIds,
        },
        verificationStatus: "verified",
        email: {
          not: null,
        },
        emailStatus: "pending",
      },
    });

    if (leads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No selected leads are eligible for outreach.",
        },
        { status: 400 }
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
            error:
              "A valid future date and time is required.",
          },
          { status: 400 }
        );
      }

      const scheduledAt = new Date(body.scheduledAt);

      if (scheduledAt <= new Date()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Scheduled date and time must be in the future.",
          },
          { status: 400 }
        );
      }

      let scheduledCount = 0;

      for (const lead of leads) {
        const subject = personalize(
          template.subject,
          lead
        );

        const emailBody = personalize(
          template.body,
          lead
        );

        await prisma.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            emailStatus: "scheduled",
            emailScheduledAt: scheduledAt,
            emailSentAt: null,
            emailError: null,

            emailTemplateId: template.id,
            emailTemplateName: template.name,
            emailSubject: subject,
            emailBody,
            emailSenderId: sender.id,
            emailSenderName: sender.name,
            emailSenderAddress: sender.email,
          },
        });

        scheduledCount++;
      }

      return NextResponse.json({
        success: true,
        message: `${scheduledCount} email(s) scheduled successfully.`,
        scheduledCount,
        scheduledAt:
          scheduledAt.toISOString(),
      });
    }

    /*
     * SEND NOW
     */
    
    if (action === "send-now") {
   const webhookUrl =
  process.env.N8N_EMAIL_WEBHOOK_URL ||
  "http://localhost:5678/webhook-test/uct-email";

      if (!webhookUrl) {
        return NextResponse.json(
          {
            success: false,
            error:
              "N8N_EMAIL_WEBHOOK_URL is not configured.",
          },
          { status: 500 }
        );
      }

      let queuedCount = 0;

      for (const lead of leads) {
        const subject = personalize(
          template.subject,
          lead
        );

        const emailBody = personalize(
          template.body,
          lead
        );

        await prisma.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            emailStatus: "sending",
            emailScheduledAt: null,
            emailSentAt: null,
            emailError: null,

            emailTemplateId: template.id,
            emailTemplateName: template.name,
            emailSubject: subject,
            emailBody,
            emailSenderId: sender.id,
            emailSenderName: sender.name,
            emailSenderAddress: sender.email,
          },
        });

        try {
          const response = await fetch(
            webhookUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                leadId: lead.id,
                toEmail: lead.email,
                subject,
                body: emailBody,
                senderName: sender.name,
                senderEmail: sender.email,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(
              `n8n returned HTTP ${response.status}`
            );
          }

          queuedCount++;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to send email.";

          await prisma.lead.update({
            where: {
              id: lead.id,
            },
            data: {
              emailStatus: "failed",
              emailError: message,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `${queuedCount} email(s) sent to n8n.`,
        queuedCount,
        totalSelected: leads.length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid action. Use schedule, send-now or create-sender.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "POST /api/email-outreach error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Email outreach request failed.",
      },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| PATCH
|--------------------------------------------------------------------------
|
| Sender edit:
| {
|   "resource": "sender",
|   "id": 1,
|   "name": "...",
|   "email": "..."
| }
|
| Email status:
| {
|   "leadIds": [1],
|   "status": "sent"
| }
|--------------------------------------------------------------------------
*/

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    /*
     * EDIT SENDER
     */
    if (body?.resource === "sender") {
      const id = Number(body?.id);

      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Valid sender ID is required.",
          },
          { status: 400 }
        );
      }

      const existingSender =
        await prisma.emailSender.findUnique({
          where: { id },
        });

      if (
        !existingSender ||
        existingSender.email !== FIXED_SENDER_EMAIL
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Only the fixed sender ${FIXED_SENDER_EMAIL} can be edited.`,
          },
          { status: 400 }
        );
      }

      if (
        typeof body?.email === "string" &&
        body.email.trim().toLowerCase() !== FIXED_SENDER_EMAIL
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Sender email must remain ${FIXED_SENDER_EMAIL}.`,
          },
          { status: 400 }
        );
      }

      const sender =
        await prisma.emailSender.update({
          where: { id },
          data: {
            ...(typeof body?.name === "string" &&
            body.name.trim()
              ? { name: body.name.trim() }
              : {}),
          },
        });

      return NextResponse.json({
        success: true,
        message: "Sender updated successfully.",
        sender,
      });
    }

    /*
     * EMAIL STATUS
     */
    const leadIds = parseIds(body?.leadIds);
    const status = body?.status as EmailStatus;

    if (leadIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one lead ID is required.",
        },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email status.",
        },
        { status: 400 }
      );
    }

    const data: {
      emailStatus: EmailStatus;
      emailSentAt?: Date | null;
      emailError?: string | null;
    } = {
      emailStatus: status,
    };

    if (status === "sent") {
      data.emailSentAt =
        validDate(body?.sentAt)
          ? new Date(body.sentAt)
          : new Date();

      data.emailError = null;
    }

    if (status === "failed") {
      data.emailError =
        typeof body?.error === "string" &&
        body.error.trim()
          ? body.error.trim()
          : "Email sending failed.";
    }

    if (
      status === "sending" ||
      status === "scheduled"
    ) {
      data.emailError = null;
    }

    const result =
      await prisma.lead.updateMany({
        where: {
          id: {
            in: leadIds,
          },
          verificationStatus: "verified",
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
    console.error(
      "PATCH /api/email-outreach error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update email status.",
      },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
|
| Cancel scheduled email:
|
| /api/email-outreach
| body:
| {
|   "leadIds": [1,2,3]
| }
|
|--------------------------------------------------------------------------
*/

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    /*
     * DELETE SENDER
     */
    if (body?.resource === "sender") {
      const id = Number(body?.id);

      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Valid sender ID is required.",
          },
          { status: 400 }
        );
      }

      const existingSender =
        await prisma.emailSender.findUnique({
          where: { id },
        });

      if (
        !existingSender ||
        existingSender.email !== FIXED_SENDER_EMAIL
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Sender not found.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: `The fixed sender ${FIXED_SENDER_EMAIL} cannot be removed.`,
        },
        { status: 400 }
      );
    }

    /*
     * CANCEL SCHEDULED EMAIL
     */
    const leadIds = parseIds(body?.leadIds);

    if (leadIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one lead ID is required.",
        },
        { status: 400 }
      );
    }

    const result =
      await prisma.lead.updateMany({
        where: {
          id: {
            in: leadIds,
          },
          verificationStatus: "verified",
          email: {
            not: null,
          },
          emailStatus: "scheduled",
        },
        data: {
          emailStatus: "pending",
          emailScheduledAt: null,
          emailError: null,
        },
      });

    return NextResponse.json({
      success: true,
      message: `${result.count} scheduled email(s) cancelled.`,
      cancelledCount: result.count,
    });
  } catch (error) {
    console.error(
      "DELETE /api/email-outreach error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process delete request.",
      },
      { status: 500 }
    );
  }
}
