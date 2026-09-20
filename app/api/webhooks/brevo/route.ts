import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

type BrevoEvent = {
  event?: string;
  messageId?: string;
  email?: string;
  date?: string;
  ts?: number;
};

function eventDate(event: BrevoEvent) {
  if (event.date) {
    const value = new Date(event.date);
    if (!Number.isNaN(value.getTime())) return value;
  }

  if (typeof event.ts === "number") {
    const value = new Date(event.ts * 1000);
    if (!Number.isNaN(value.getTime())) return value;
  }

  return new Date();
}

async function handleTransactionalEvent(event: BrevoEvent) {
  const messageId = String(event.messageId || "").trim();
  const email = String(event.email || "").trim().toLowerCase();
  const type = String(event.event || "").trim().toLowerCase();

  if (!messageId && !email) return;

  const lead = await prisma.lead.findFirst({
    where: messageId
      ? { emailMessageId: messageId }
      : { email },
    select: { id: true },
  });

  if (!lead) return;

  const occurredAt = eventDate(event);

  if (type === "delivered") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        emailStatus: "delivered",
        emailDeliveredAt: occurredAt,
        emailError: null,
        ...(messageId ? { emailMessageId: messageId } : {}),
      },
    });
    return;
  }

  if (type === "opened" || type === "uniqueopened") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        emailOpenedAt: occurredAt,
        ...(messageId ? { emailMessageId: messageId } : {}),
      },
    });
    return;
  }

  if (type === "click") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        emailClickedAt: occurredAt,
        ...(messageId ? { emailMessageId: messageId } : {}),
      },
    });
    return;
  }

  if (
    ["hardbounce", "softbounce", "blocked", "invalid", "deferred", "error", "spam"].includes(
      type
    )
  ) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        emailStatus: "failed",
        emailError: `Brevo event: ${event.event || type}`,
        ...(messageId ? { emailMessageId: messageId } : {}),
      },
    });
  }
}

async function handleInboundReply(payload: any) {
  const items = Array.isArray(payload?.items) ? payload.items : [];

  for (const item of items) {
    const from =
      typeof item?.From?.Address === "string"
        ? item.From.Address.trim().toLowerCase()
        : "";

    if (!from) continue;

    const lead = await prisma.lead.findFirst({
      where: {
        email: from,
        verificationStatus: "verified",
      },
      select: { id: true },
    });

    if (!lead) continue;

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        emailStatus: "replied",
        emailRepliedAt: new Date(),
        emailError: null,
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (payload?.items) {
      await handleInboundReply(payload);
    } else {
      const events: BrevoEvent[] = Array.isArray(payload)
        ? payload
        : [payload];

      for (const event of events) {
        await handleTransactionalEvent(event);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/webhooks/brevo error:", error);

    return NextResponse.json(
      { success: false, error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
