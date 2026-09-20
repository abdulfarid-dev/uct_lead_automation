import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const webAppUrl =
      process.env.GOOGLE_SHEETS_WEB_APP_URL;

    if (!webAppUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GOOGLE_SHEETS_WEB_APP_URL is not configured.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    const responseText = await response.text();

    let result: any;

    try {
      result = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      result = {
        success: false,
        error: responseText || "Invalid response from Google Apps Script.",
      };
    }

    console.log(
      "Google Apps Script response:",
      result
    );

    // IMPORTANT:
    // Apps Script itself can return success:false
    // even when HTTP response is 200.
    if (!response.ok || result.success === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            result.message ||
            "Google Sheets export failed.",
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "Verified Data Export API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to export verified data.",
      },
      { status: 500 }
    );
  }
}