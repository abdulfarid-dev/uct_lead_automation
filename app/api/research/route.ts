import prisma from "../../lib/prisma";
import {
  createResearchJob,
  runResearch,
  validateResearchRequest,
} from "../../lib/research";

export async function GET() {
  try {
    const [totalLeads, researchedDomains] = await Promise.all([
      prisma.lead.count(),
      prisma.researchDomain.findMany({
        select: {
          domain: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    return Response.json({
      success: true,
      totalLeads,
      researchedDomains: researchedDomains.map(
        ({ domain }) => domain
      ),
    });
  } catch (error) {
    console.error("Get research data error:", error);

    return Response.json(
      {
        success: false,
        error: "Could not load research data.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const limit = Number(body?.limit ?? 10);

    if (!Number.isFinite(limit) || limit < 1) {
      return Response.json(
        {
          success: false,
          error: "Research limit must be at least 1.",
        },
        { status: 400 }
      );
    }

    const validationError = validateResearchRequest({
      prompt: body?.prompt,
    });

    if (validationError) {
      return Response.json(
        {
          success: false,
          error: validationError,
        },
        { status: 400 }
      );
    }

    const cachedWebsites: string[] = Array.isArray(
      body?.cachedWebsites
    )
      ? body.cachedWebsites
          .filter(
            (value: unknown): value is string =>
              typeof value === "string"
          )
          .slice(0, 5000)
      : [];

    const job = createResearchJob({
      prompt: body.prompt,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: unknown) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(data)}\n\n`
            )
          );
        };

        try {
          const leads = await runResearch(job, {
            limit: Math.floor(limit),

            // Browser cache is only an optimization.
            // PostgreSQL remains the permanent source of truth.
            excludedWebsites: new Set(
              cachedWebsites
            ),

            onEvent: (event) => {
              sendEvent({
                type: "activity",
                event,
              });
            },
          });

          const totalLeads =
            await prisma.lead.count();

          sendEvent({
            type: "complete",
            success: true,
            jobId: job.id,
            status: "COMPLETED",
            leadsFound: leads.length,
            totalLeads,
            leads,
          });
        } catch (error) {
          console.error(
            "Research API error:",
            error
          );

          sendEvent({
            type: "error",
            message:
              "Research could not be completed.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(
      "Research request error:",
      error
    );

    return Response.json(
      {
        success: false,
        error: "Invalid research request.",
      },
      { status: 400 }
    );
  }
}