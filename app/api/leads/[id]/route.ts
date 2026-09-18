
import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function normalizeWebsite(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function normalizePhone(value: string): string | null {
  const phone = value.replace(/\D/g, "");
  return phone || null;
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email || null;
}

/*
 * UPDATE LEAD
 * PATCH /api/leads/:id
 */
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const leadId = Number(id);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid lead ID.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const existingLead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!existingLead) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found.",
        },
        { status: 404 }
      );
    }

    const sector =
      typeof body.sector === "string"
        ? body.sector.trim()
        : existingLead.sector;

    const website =
      typeof body.website === "string"
        ? normalizeWebsite(body.website)
        : existingLead.website;

    const location =
      typeof body.location === "string"
        ? body.location.trim()
        : existingLead.location;

    const phone =
      typeof body.phone === "string"
        ? normalizePhone(body.phone)
        : existingLead.phone;

    const email =
      typeof body.email === "string"
        ? normalizeEmail(body.email)
        : existingLead.email;

    const googleBusinessProfile =
      typeof body.googleBusinessProfile === "string"
        ? body.googleBusinessProfile.trim()
        : existingLead.googleBusinessProfile;

    const verificationStatus =
      typeof body.verificationStatus === "string"
        ? body.verificationStatus.trim().toLowerCase()
        : existingLead.verificationStatus;

    /*
     * WEBSITE IS THE ONLY REQUIRED FIELD
     */
    if (!website) {
      return NextResponse.json(
        {
          success: false,
          error: "Website is required.",
        },
        { status: 400 }
      );
    }

    /*
     * VALID VERIFICATION STATUS
     */
    const allowedStatuses = [
      "under_review",
      "verified",
      "rejected",
    ];

    if (!allowedStatuses.includes(verificationStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid verification status.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent website duplicate on another lead
     */
    const duplicateWebsite =
      await prisma.lead.findFirst({
        where: {
          website,
          NOT: {
            id: leadId,
          },
        },
      });

    if (duplicateWebsite) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Another lead with this website already exists.",
        },
        { status: 409 }
      );
    }

    /*
     * Prevent phone duplicate on another lead
     */
    if (phone) {
      const duplicatePhone =
        await prisma.lead.findFirst({
          where: {
            phone,
            NOT: {
              id: leadId,
            },
          },
        });

      if (duplicatePhone) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Another lead with this phone number already exists.",
          },
          { status: 409 }
        );
      }
    }

    /*
     * Prevent email duplicate on another lead
     */
    if (email) {
      const duplicateEmail =
        await prisma.lead.findFirst({
          where: {
            email,
            NOT: {
              id: leadId,
            },
          },
        });

      if (duplicateEmail) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Another lead with this email already exists.",
          },
          { status: 409 }
        );
      }
    }

    const updatedLead = await prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        sector: sector || "",
        website,
        location: location || null,
        phone: phone || null,
        email: email || null,
        googleBusinessProfile:
          googleBusinessProfile || null,

        verificationStatus,

        verifiedAt:
          verificationStatus === "verified"
            ? existingLead.verifiedAt ?? new Date()
            : null,
      },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    });
  } catch (error) {
    console.error(
      "PATCH /api/leads/:id error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update lead.",
      },
      { status: 500 }
    );
  }
}

/*
 * DELETE LEAD
 * DELETE /api/leads/:id
 */
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const leadId = Number(id);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid lead ID.",
        },
        { status: 400 }
      );
    }

    const existingLead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!existingLead) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found.",
        },
        { status: 404 }
      );
    }

    await prisma.lead.delete({
      where: {
        id: leadId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Lead deleted successfully.",
      deletedId: leadId,
    });
  } catch (error) {
    console.error(
      "DELETE /api/leads/:id error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete lead.",
      },
      { status: 500 }
    );
  }
}

// import { NextResponse } from "next/server";
// import prisma from "../../../lib/prisma";

// interface RouteContext {
//   params: Promise<{
//     id: string;
//   }>;
// }

// function normalizeWebsite(value: string): string {
//   return value
//     .trim()
//     .toLowerCase()
//     .replace(/^https?:\/\//, "")
//     .replace(/^www\./, "")
//     .replace(/\/+$/, "");
// }

// function normalizePhone(value: string): string | null {
//   const phone = value.replace(/\D/g, "");
//   return phone || null;
// }

// function normalizeEmail(value: string): string | null {
//   const email = value.trim().toLowerCase();
//   return email || null;
// }

// /*
//  * UPDATE LEAD
//  * PATCH /api/leads/:id
//  */
// export async function PATCH(
//   request: Request,
//   context: RouteContext
// ) {
//   try {
//     const { id } = await context.params;
//     const leadId = Number(id);

//     if (!Number.isInteger(leadId) || leadId <= 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Invalid lead ID.",
//         },
//         { status: 400 }
//       );
//     }

//     const body = await request.json();

//     const sector =
//       typeof body.sector === "string"
//         ? body.sector.trim()
//         : "";

//     const website =
//       typeof body.website === "string"
//         ? normalizeWebsite(body.website)
//         : "";

//     const location =
//       typeof body.location === "string"
//         ? body.location.trim()
//         : "";

//     const phone =
//       typeof body.phone === "string"
//         ? normalizePhone(body.phone)
//         : null;

//     const email =
//       typeof body.email === "string"
//         ? normalizeEmail(body.email)
//         : null;

//     const googleBusinessProfile =
//       typeof body.googleBusinessProfile === "string"
//         ? body.googleBusinessProfile.trim()
//         : "";

//     if (!sector || !website) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Sector and website are required.",
//         },
//         { status: 400 }
//       );
//     }

//     // Check whether the lead exists
//     const existingLead = await prisma.lead.findUnique({
//       where: {
//         id: leadId,
//       },
//     });

//     if (!existingLead) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Lead not found.",
//         },
//         { status: 404 }
//       );
//     }

//     // Prevent website duplicate on another lead
//     const duplicateWebsite =
//       await prisma.lead.findFirst({
//         where: {
//           website,
//           NOT: {
//             id: leadId,
//           },
//         },
//       });

//     if (duplicateWebsite) {
//       return NextResponse.json(
//         {
//           success: false,
//           error:
//             "Another lead with this website already exists.",
//         },
//         { status: 409 }
//       );
//     }

//     // Prevent phone duplicate on another lead
//     if (phone) {
//       const duplicatePhone =
//         await prisma.lead.findFirst({
//           where: {
//             phone,
//             NOT: {
//               id: leadId,
//             },
//           },
//         });

//       if (duplicatePhone) {
//         return NextResponse.json(
//           {
//             success: false,
//             error:
//               "Another lead with this phone number already exists.",
//           },
//           { status: 409 }
//         );
//       }
//     }

//     // Prevent email duplicate on another lead
//     if (email) {
//       const duplicateEmail =
//         await prisma.lead.findFirst({
//           where: {
//             email,
//             NOT: {
//               id: leadId,
//             },
//           },
//         });

//       if (duplicateEmail) {
//         return NextResponse.json(
//           {
//             success: false,
//             error:
//               "Another lead with this email already exists.",
//           },
//           { status: 409 }
//         );
//       }
//     }

//     const updatedLead = await prisma.lead.update({
//       where: {
//         id: leadId,
//       },
//       data: {
//         sector,
//         website,
//         location: location || null,
//         phone,
//         email,
//         googleBusinessProfile:
//           googleBusinessProfile || null,
//       },
//     });

//     return NextResponse.json({
//       success: true,
//       lead: updatedLead,
//     });
//   } catch (error) {
//     console.error("PATCH /api/leads/:id error:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         error: "Failed to update lead.",
//       },
//       { status: 500 }
//     );
//   }
// }

// /*
//  * DELETE LEAD
//  * DELETE /api/leads/:id
//  */
// export async function DELETE(
//   request: Request,
//   context: RouteContext
// ) {
//   try {
//     const { id } = await context.params;
//     const leadId = Number(id);

//     if (!Number.isInteger(leadId) || leadId <= 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Invalid lead ID.",
//         },
//         { status: 400 }
//       );
//     }

//     const existingLead = await prisma.lead.findUnique({
//       where: {
//         id: leadId,
//       },
//     });

//     if (!existingLead) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Lead not found.",
//         },
//         { status: 404 }
//       );
//     }

//     await prisma.lead.delete({
//       where: {
//         id: leadId,
//       },
//     });

//     return NextResponse.json({
//       success: true,
//       message: "Lead deleted successfully.",
//       deletedId: leadId,
//     });
//   } catch (error) {
//     console.error("DELETE /api/leads/:id error:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         error: "Failed to delete lead.",
//       },
//       { status: 500 }
//     );
//   }
// }