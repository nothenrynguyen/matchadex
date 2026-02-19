import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/monitoring";
import { getCurrentPrismaUser } from "@/lib/auth";

type SortOption = "rating_desc" | "rating_asc" | "name_asc" | "name_desc";

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function parsePositiveInt(value: string | null, fallbackValue: number) {
  if (!value) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function parseSort(value: string | null): SortOption {
  const sortOption = value?.toLowerCase();

  if (
    sortOption === "rating_desc" ||
    sortOption === "rating_asc" ||
    sortOption === "name_asc" ||
    sortOption === "name_desc"
  ) {
    return sortOption;
  }

  return "rating_desc";
}

function getSortableRating(value: number | null, sortOption: SortOption) {
  if (value === null) {
    return sortOption === "rating_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  return value;
}

export async function GET(request: NextRequest) {
  try {
    const prismaUser = await getCurrentPrismaUser();

    // parse query parameters for filtering and pagination
    const cityParam = request.nextUrl.searchParams.get("city")?.trim();
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 6);
    const sort = parseSort(request.nextUrl.searchParams.get("sort"));

    if (cityParam !== undefined && cityParam !== null && cityParam.length === 0) {
      return NextResponse.json({ error: "city must not be empty" }, { status: 400 });
    }

    if (page === null) {
      return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
    }

    if (pageSize === null || pageSize > 50) {
      return NextResponse.json(
        { error: "pageSize must be a positive integer up to 50" },
        { status: 400 },
      );
    }

    // load cafes using optional exact city filter
    const cafes = await prisma.cafe.findMany({
      where: cityParam ? { city: cityParam } : undefined,
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

    // merge cafe rows with computed rating summary
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

    // apply sorting rules in memory to allow rating-based ordering
    cafesWithAverages.sort((leftCafe, rightCafe) => {
      if (sort === "rating_desc" || sort === "rating_asc") {
        const leftRating = getSortableRating(leftCafe.averageRatings.overallRating, sort);
        const rightRating = getSortableRating(rightCafe.averageRatings.overallRating, sort);

        if (leftRating !== rightRating) {
          return sort === "rating_desc" ? rightRating - leftRating : leftRating - rightRating;
        }
      }

      if (sort === "name_desc") {
        return rightCafe.name.localeCompare(leftCafe.name);
      }

      return leftCafe.name.localeCompare(rightCafe.name);
    });

    const total = cafesWithAverages.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedCafes = cafesWithAverages.slice(startIndex, startIndex + pageSize);

    const favoriteCafeIds =
      prismaUser && pagedCafes.length > 0
        ? new Set(
            (
              await prisma.favorite.findMany({
                where: {
                  userId: prismaUser.id,
                  cafeId: { in: pagedCafes.map((cafe) => cafe.id) },
                },
                select: { cafeId: true },
              })
            ).map((favorite) => favorite.cafeId),
          )
        : new Set<string>();

    return NextResponse.json({
      cafes: pagedCafes.map((cafe) => ({
        ...cafe,
        isFavorited: favoriteCafeIds.has(cafe.id),
      })),
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
      sort,
    });
  } catch (error) {
    await logError("GET /api/cafes failed", error, {
      route: "/api/cafes",
      method: "GET",
    });
    return NextResponse.json(
      { error: "failed to load cafes" },
      { status: 500 },
    );
  }
}
