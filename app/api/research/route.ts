import prisma from "../../lib/prisma";
import {
  createResearchJob,
  runResearch,
  validateResearchRequest,
} from "../../lib/research";

export async function GET() {
  try {
    const totalLeads = await prisma.lead.count();

    return Response.json({
      success: true,
      totalLeads,
    });
  } catch (error) {
    console.error("Get lead count error:", error);

    return Response.json(
      {
        success: false,
        error: "Could not load lead count.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const limit = Number(body.limit ?? 10);

    if (!Number.isFinite(limit) || limit < 1) {
      return Response.json(
        { error: "Research limit must be at least 1." },
        { status: 400 }
      );
    }

    const error = validateResearchRequest({
      prompt: body.prompt,
    });

    if (error) {
      return Response.json(
        { error },
        { status: 400 }
      );
    }

    const job = createResearchJob({
      prompt: body.prompt,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          const leads = await runResearch(job, {
            limit: Math.floor(limit),
            onEvent: (event) => {
              sendEvent({
                type: "activity",
                event,
              });
            },
          });

          const totalLeads = await prisma.lead.count();

          sendEvent({
            type: "complete",
            success: true,
            jobId: job.id,
            status: "COMPLETED",
            leadsFound: leads.length,
            totalLeads,
            leads,
          });

          controller.close();
        } catch (error) {
          console.error("Research API error:", error);

          sendEvent({
            type: "error",
            message: "Research could not be completed.",
          });

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Research request error:", error);

    return Response.json(
      {
        success: false,
        error: "Invalid research request.",
      },
      { status: 400 }
    );
  }
}
