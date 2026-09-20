import { NextResponse } from "next/server";

const BREVO_API_URL =
  "https://api.brevo.com/v3/smtp/statistics/aggregatedReport";

function percent(value: number, total: number) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

export async function GET(request: Request) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "BREVO_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(
      Math.max(Number(searchParams.get("days") || 90), 1),
      90
    );

    const response = await fetch(`${BREVO_API_URL}?days=${days}`, {
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
          error: data?.message || "Failed to fetch Brevo performance.",
        },
        { status: response.status }
      );
    }

    const sent = Number(data?.requests || 0);
    const delivered = Number(data?.delivered || 0);
    const opens = Number(data?.uniqueOpens ?? data?.opens ?? 0);
    const clicks = Number(data?.uniqueClicks ?? data?.clicks ?? 0);
    const unsubscribes = Number(data?.unsubscribed || 0);

    return NextResponse.json({
      success: true,
      range: data?.range || null,
      days,
      metrics: {
        sent,
        delivered,
        deliveredRate: percent(delivered, sent),
        opens,
        openRate: percent(opens, delivered),
        clicks,
        clickRate: percent(clicks, delivered),
        conversions: 0,
        conversionRate: 0,
        unsubscribes,
        unsubscribeRate: percent(unsubscribes, delivered),
      },
      raw: {
        hardBounces: Number(data?.hardBounces || 0),
        softBounces: Number(data?.softBounces || 0),
        blocked: Number(data?.blocked || 0),
        invalid: Number(data?.invalid || 0),
        spamReports: Number(data?.spamReports || 0),
      },
    });
  } catch (error) {
    console.error("GET /api/email-outreach/performance error:", error);

    return NextResponse.json(
      { success: false, error: "Failed to fetch Brevo performance." },
      { status: 500 }
    );
  }
}
