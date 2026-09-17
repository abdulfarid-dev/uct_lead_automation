import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    console.log("PostgreSQL connected successfully");

    return NextResponse.json({
      success: true,
      message: "PostgreSQL connected successfully",
    });
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "PostgreSQL connection failed",
      },
      { status: 500 }
    );
  }
}