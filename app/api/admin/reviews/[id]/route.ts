import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // check if admin allowlist is configured
    const adminEmails = getAdminEmails();

    if (adminEmails.length === 0) {
      return NextResponse.json(
        { error: "admin email list is not configured" },
        { status: 500 },
      );
    }

    // read caller identity from request header
    const requesterEmail = request.headers.get("x-user-email")?.trim().toLowerCase();

    if (!requesterEmail) {
      return NextResponse.json({ error: "x-user-email header is required" }, { status: 401 });
    }

    if (!adminEmails.includes(requesterEmail)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json({ error: "review id is required" }, { status: 400 });
    }

    // delete targeted review row
    const deletedReview = await prisma.review.delete({
      where: { id: id.trim() },
    });

    return NextResponse.json({ deletedReview });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "review not found" }, { status: 404 });
    }

    console.error("DELETE /api/admin/reviews/:id failed", error);
    return NextResponse.json(
      { error: "failed to delete review" },
      { status: 500 },
    );
  }
}
