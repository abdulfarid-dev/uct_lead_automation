import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

type EmailStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";

const VALID_STATUSES: EmailStatus[] = [
  "pending",
  "scheduled",
  "sending",
  "sent",
  "failed",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedStatus =
      searchParams.get("status") || "pending";

    const status: EmailStatus =
      VALID_STATUSES.includes(
        requestedStatus as EmailStatus
      )
        ? (requestedStatus as EmailStatus)
        : "pending";

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
      "GET /api/leads/verified-email error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch verified email leads.",
      },
      {
        status: 500,
      }
    );
  }
}