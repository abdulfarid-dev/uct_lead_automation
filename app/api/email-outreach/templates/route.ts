import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/*
|--------------------------------------------------------------------------
| GET - Fetch all templates
|--------------------------------------------------------------------------
*/

export async function GET() {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      templates,
      total: templates.length,
    });
  } catch (error) {
    console.error(
      "GET /api/email-outreach/templates error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch email templates.",
      },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST - Create template
|--------------------------------------------------------------------------
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = cleanString(body?.name);
    const subject = cleanString(body?.subject);
    const message = cleanString(body?.body);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Template name is required.",
        },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          error: "Email subject is required.",
        },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Email message is required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.emailTemplate.findUnique({
      where: {
        name,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "A template with this name already exists.",
        },
        { status: 409 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body: message,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Email template created successfully.",
        template,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/email-outreach/templates error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create email template.",
      },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| PATCH - Edit template
|--------------------------------------------------------------------------
*/

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const id = Number(body?.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid template ID is required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Template not found.",
        },
        { status: 404 }
      );
    }

    const name =
      body?.name !== undefined
        ? cleanString(body.name)
        : existing.name;

    const subject =
      body?.subject !== undefined
        ? cleanString(body.subject)
        : existing.subject;

    const message =
      body?.body !== undefined
        ? cleanString(body.body)
        : existing.body;

    if (!name || !subject || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, subject and message are required.",
        },
        { status: 400 }
      );
    }

    const duplicate = await prisma.emailTemplate.findFirst({
      where: {
        name,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "Another template already uses this name.",
        },
        { status: 409 }
      );
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        body: message,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email template updated successfully.",
      template,
    });
  } catch (error) {
    console.error(
      "PATCH /api/email-outreach/templates error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update email template.",
      },
      { status: 500 }
    );
  }
}

/*
|--------------------------------------------------------------------------
| DELETE - Delete template
|--------------------------------------------------------------------------
*/

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid template ID is required.",
        },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: "Template not found.",
        },
        { status: 404 }
      );
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Email template deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/email-outreach/templates error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete email template.",
      },
      { status: 500 }
    );
  }
}