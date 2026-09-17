import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

function normalizeWebsite(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  return email || null;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const phone = value.replace(/\D/g, "");

  return phone || null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text || null;
}

/**
 * GET /api/leads
 * Fetch all leads
 */
export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      leads,
      total: leads.length,
    });
  } catch (error) {
    console.error("GET /api/leads error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch leads.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * POST /api/leads
 * Create a new lead
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sector = normalizeText(body.sector);
    const website = normalizeWebsite(body.website);
    const location = normalizeText(body.location);
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    const googleBusinessProfile = normalizeText(
      body.googleBusinessProfile
    );

    if (!sector) {
      return NextResponse.json(
        {
          success: false,
          error: "Sector is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!website) {
      return NextResponse.json(
        {
          success: false,
          error: "Website is required.",
        },
        {
          status: 400,
        }
      );
    }

    // Duplicate website
    const existingWebsite = await prisma.lead.findUnique({
      where: {
        website,
      },
    });

    if (existingWebsite) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A lead with this website already exists.",
        },
        {
          status: 409,
        }
      );
    }

    // Duplicate phone
    if (phone) {
      const existingPhone = await prisma.lead.findUnique({
        where: {
          phone,
        },
      });

      if (existingPhone) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A lead with this phone number already exists.",
          },
          {
            status: 409,
          }
        );
      }
    }

    // Duplicate email
    if (email) {
      const existingEmail = await prisma.lead.findUnique({
        where: {
          email,
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A lead with this email already exists.",
          },
          {
            status: 409,
          }
        );
      }
    }

    const lead = await prisma.lead.create({
      data: {
        sector,
        website,
        location,
        phone,
        email,
        googleBusinessProfile,
      },
    });

    return NextResponse.json(
      {
        success: true,
        lead,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("POST /api/leads error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create lead.",
      },
      {
        status: 500,
      }
    );
  }
}