import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentPrismaUser } from "@/lib/auth";

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const prismaUser = await getCurrentPrismaUser();

    const { id } = await context.params;
    const reviewId = id?.trim();

    if (!reviewId) {
      return NextResponse.json({ error: "review id is required" }, { status: 400 });
    }

    // map authenticated user to local prisma user id
    if (!prismaUser) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });

    if (!review) {
      return NextResponse.json({ error: "review not found" }, { status: 404 });
    }

    if (review.userId !== prismaUser.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const deletedReview = await prisma.review.delete({
      where: { id: reviewId },
    });

    return NextResponse.json({ deletedReview });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "review not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to delete review" },
      { status: 500 },
    );
  }
}
