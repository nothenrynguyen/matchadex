import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/monitoring";
import { getCurrentPrismaUser } from "@/lib/auth";

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const prismaUser = await getCurrentPrismaUser();
    const { id } = await context.params;
    const cafeId = id?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
    }

    // load cafe details with recent review rows
    const cafe = await prisma.cafe.findUnique({
      where: { id: cafeId },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            cafeId: true,
            tasteRating: true,
            aestheticRating: true,
            studyRating: true,
            textComment: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!cafe) {
      return NextResponse.json({ error: "cafe not found" }, { status: 404 });
    }

    // aggregate averages to display summary stats on detail page
    const ratingAggregate = await prisma.review.aggregate({
      where: { cafeId },
      _count: { _all: true },
      _avg: {
        tasteRating: true,
        aestheticRating: true,
        studyRating: true,
      },
    });

    return NextResponse.json({
      cafe: {
        ...cafe,
        viewerPrismaUserId: prismaUser?.id ?? null,
        isFavorited: prismaUser
          ? Boolean(
              await prisma.favorite.findUnique({
                where: {
                  userId_cafeId: {
                    userId: prismaUser.id,
                    cafeId,
                  },
                },
                select: { id: true },
              }),
            )
          : false,
        averageRatings: {
          reviewCount: ratingAggregate._count._all,
          tasteRating: toAverage(ratingAggregate._avg.tasteRating),
          aestheticRating: toAverage(ratingAggregate._avg.aestheticRating),
          studyRating: toAverage(ratingAggregate._avg.studyRating),
          overallRating:
            ratingAggregate._avg.tasteRating === null ||
            ratingAggregate._avg.aestheticRating === null ||
            ratingAggregate._avg.studyRating === null
              ? null
              : toAverage(
                  (ratingAggregate._avg.tasteRating +
                    ratingAggregate._avg.aestheticRating +
                    ratingAggregate._avg.studyRating) /
                    3,
                ),
        },
      },
    });
  } catch (error) {
    await logError("GET /api/cafes/:id failed", error, {
      route: "/api/cafes/[id]",
      method: "GET",
    });
    return NextResponse.json(
      { error: "failed to load cafe" },
      { status: 500 },
    );
  }
}
