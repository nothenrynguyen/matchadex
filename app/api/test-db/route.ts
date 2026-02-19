import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

export async function GET() {
  try {
    const cafeCount = await prisma.cafe.count();

    return NextResponse.json({
      ok: true,
      cafeCount,
    });
  } catch (error) {
    console.error("[api/test-db] prisma.cafe.count failed", {
      error: toErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const detailedMessage =
      process.env.NODE_ENV === "development"
        ? `database check failed: ${toErrorMessage(error)}`
        : "database check failed";

    return NextResponse.json(
      {
        ok: false,
        error: detailedMessage,
      },
      { status: 500 },
    );
  }
}
