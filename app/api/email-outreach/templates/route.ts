import { NextResponse } from "next/server";

const BREVO_API_URL = "https://api.brevo.com/v3";

function getApiKey() {
  return process.env.BREVO_API_KEY;
}

export async function GET(request: Request) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "BREVO_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const url = id
      ? `${BREVO_API_URL}/smtp/templates/${encodeURIComponent(id)}`
      : `${BREVO_API_URL}/smtp/templates?limit=50&offset=0&sort=desc`;

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "api-key": apiKey,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data?.message || "Failed to fetch Brevo templates.",
        },
        { status: response.status }
      );
    }

    if (id) {
      return NextResponse.json({
        success: true,
        template: data,
      });
    }

    const templates = Array.isArray(data?.templates)
      ? data.templates
          .filter((item: any) => item?.isActive !== false)
          .map((item: any) => ({
            id: Number(item.id),
            name: String(item.name || `Template ${item.id}`),
            subject: String(item.subject || ""),
            isActive: item.isActive !== false,
            sender: item.sender
              ? {
                  id: item.sender.id ?? null,
                  name: String(item.sender.name || ""),
                  email: String(item.sender.email || ""),
                }
              : null,
            modifiedAt: item.modifiedAt || null,
            templateId: Number(item.id),
          }))
      : [];

    return NextResponse.json({
      success: true,
      templates,
      total: templates.length,
    });
  } catch (error) {
    console.error("GET /api/email-outreach/templates error:", error);

    return NextResponse.json(
      { success: false, error: "Failed to fetch Brevo templates." },
      { status: 500 }
    );
  }
}