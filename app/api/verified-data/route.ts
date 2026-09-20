import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export async function GET() {
  try {
    const verifiedLeads = await prisma.lead.findMany({
      where: {
        verificationStatus: {
          equals: "verified",
          mode: "insensitive",
        },
      },
      orderBy: {
        verifiedAt: "desc",
      },
    });

    return NextResponse.json(verifiedLeads);
  } catch (error) {
    console.error("Verified Data GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch verified data" },
      { status: 500 }
    );
  }
}