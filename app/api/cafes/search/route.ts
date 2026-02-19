import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

export async function GET(request: NextRequest) {
  try {
    // validate search query for cafe names
    const queryParam = request.nextUrl.searchParams.get("q")?.trim();

    if (!queryParam) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    // search cafe names case-insensitively
    const cafes = await prisma.cafe.findMany({
      where: {
        name: {
          contains: queryParam,
          mode: "insensitive",
        },
      },
      orderBy: { name: "asc" },
    });

    const cafeIds = cafes.map((cafe) => cafe.id);

    // aggregate review metrics for matched cafes
    const ratingGroups =
      cafeIds.length > 0
        ? await prisma.review.groupBy({
            by: ["cafeId"],
            where: { cafeId: { in: cafeIds } },
            _count: { _all: true },
            _avg: {
              tasteRating: true,
              aestheticRating: true,
              studyRating: true,
            },
          })
        : [];

    const ratingMap = new Map(
      ratingGroups.map((group) => [
        group.cafeId,
        {
          reviewCount: group._count._all,
          tasteRating: toAverage(group._avg.tasteRating),
          aestheticRating: toAverage(group._avg.aestheticRating),
          studyRating: toAverage(group._avg.studyRating),
          overallRating:
            group._avg.tasteRating === null ||
            group._avg.aestheticRating === null ||
            group._avg.studyRating === null
              ? null
              : toAverage(
                  (group._avg.tasteRating +
                    group._avg.aestheticRating +
                    group._avg.studyRating) /
                    3,
                ),
        },
      ]),
    );

    // return cafes with averages to power UI cards
    const cafesWithAverages = cafes.map((cafe) => ({
      ...cafe,
      averageRatings: ratingMap.get(cafe.id) ?? {
        reviewCount: 0,
        tasteRating: null,
        aestheticRating: null,
        studyRating: null,
        overallRating: null,
      },
    }));

    return NextResponse.json({ cafes: cafesWithAverages });
  } catch (error) {
    console.error("GET /api/cafes/search failed", error);
    return NextResponse.json(
      { error: "failed to search cafes" },
      { status: 500 },
    );
  }
}
