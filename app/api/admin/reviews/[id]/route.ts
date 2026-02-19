import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/monitoring";
import { getCurrentAuthUser } from "@/lib/auth";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function DELETE(
  _: NextRequest,
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

    // read caller identity from authenticated Supabase session
    const authUser = await getCurrentAuthUser();
    const requesterEmail = authUser?.email?.trim().toLowerCase();

    if (!requesterEmail) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

    await logInfo("admin deleted review", {
      route: "/api/admin/reviews/[id]",
      method: "DELETE",
      metadata: {
        reviewId: id.trim(),
        requesterEmail,
      },
    });

    return NextResponse.json({ deletedReview });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "review not found" }, { status: 404 });
    }

    await logError("DELETE /api/admin/reviews/:id failed", error, {
      route: "/api/admin/reviews/[id]",
      method: "DELETE",
    });
    return NextResponse.json(
      { error: "failed to delete review" },
      { status: 500 },
    );
  }
}
