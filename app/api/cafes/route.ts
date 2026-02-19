import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

export async function GET(request: NextRequest) {
  try {
    // read optional city filter from query string
    const cityParam = request.nextUrl.searchParams.get("city")?.trim();

    if (cityParam !== undefined && cityParam !== null && cityParam.length === 0) {
      return NextResponse.json({ error: "city must not be empty" }, { status: 400 });
    }

    // load cafes using optional exact city filter
    const cafes = await prisma.cafe.findMany({
      where: cityParam ? { city: cityParam } : undefined,
      orderBy: { name: "asc" },
    });

    const cafeIds = cafes.map((cafe) => cafe.id);

    // aggregate review metrics for each cafe in one query
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

    // merge cafe row with pre-computed averages
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
    console.error("GET /api/cafes failed", error);
    return NextResponse.json(
      { error: "failed to load cafes" },
      { status: 500 },
    );
  }
}
