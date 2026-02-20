import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/monitoring";
import { getCurrentPrismaUser } from "@/lib/auth";
import { normalizeForSearch } from "@/lib/text/normalizeForSearch";

type SortOption = "rating" | "popularity";

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function toRoundedNumber(value: number) {
  return Number(value.toFixed(2));
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

  if (sortOption === "rating" || sortOption === "popularity") {
    return sortOption;
  }

  return "rating";
}

function parseCityFilters(searchParams: URLSearchParams) {
  const rawCityValues = searchParams.getAll("city");
  const normalized = rawCityValues
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.toLowerCase() !== "all");

  const expanded = normalized.flatMap((value) => {
    if (value === "Bay") {
      return ["Bay", "Bay Area"];
    }

    if (value === "Bay Area") {
      return ["Bay Area", "Bay"];
    }

    return [value];
  });

  return Array.from(new Set(expanded));
}

export async function GET(request: NextRequest) {
  try {
    const prismaUser = await getCurrentPrismaUser();

    // validate query and parse filtering parameters
    const queryParam = request.nextUrl.searchParams.get("q")?.trim();
    const cityFilters = parseCityFilters(request.nextUrl.searchParams);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 6);
    const sort = parseSort(request.nextUrl.searchParams.get("sort"));

    if (!queryParam) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }
    const normalizedQuery = normalizeForSearch(queryParam);

    if (page === null) {
      return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
    }

    if (pageSize === null || pageSize > 50) {
      return NextResponse.json(
        { error: "pageSize must be a positive integer up to 50" },
        { status: 400 },
      );
    }

    // search cafe names with optional city filter; normalize for diacritics in memory
    const cafes = await prisma.cafe.findMany({
      where: {
        isHidden: false,
        ...(cityFilters.length > 0 ? { city: { in: cityFilters } } : {}),
      },
    });

    const matchedCafes = cafes.filter((cafe) =>
      normalizeForSearch(cafe.name).includes(normalizedQuery),
    );

    const cafeIds = matchedCafes.map((cafe) => cafe.id);

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

    const ratingMap = new Map<string, { reviewCount: number; averageRating: number | null }>();

    for (const group of ratingGroups) {
      const tasteRating = group._avg.tasteRating;
      const aestheticRating = group._avg.aestheticRating;
      const studyRating = group._avg.studyRating;

      const averageRating =
        tasteRating === null || aestheticRating === null || studyRating === null
          ? null
          : toAverage((tasteRating + aestheticRating + studyRating) / 3);

      ratingMap.set(group.cafeId, {
        reviewCount: group._count._all,
        averageRating,
      });
    }

    const cafesWithMetrics = matchedCafes.map((cafe) => ({
      ...cafe,
      ...(ratingMap.get(cafe.id) ?? {
        reviewCount: 0,
        averageRating: null,
      }),
    }));

    const weightedMinReviews = 5;
    const priorRating = 3;

    const cafesWithComputedScore = cafesWithMetrics.map((cafe) => {
      const reviewCount = cafe.reviewCount;
      const averageRating = cafe.averageRating ?? 0;
      const weightedRating =
        (averageRating * reviewCount + priorRating * weightedMinReviews) /
        (reviewCount + weightedMinReviews);

      return {
        ...cafe,
        weightedRating: reviewCount === 0 ? null : toRoundedNumber(weightedRating),
      };
    });

    cafesWithComputedScore.sort((leftCafe, rightCafe) => {
      if (sort === "popularity") {
        if (leftCafe.reviewCount !== rightCafe.reviewCount) {
          return rightCafe.reviewCount - leftCafe.reviewCount;
        }

        const leftWeighted = leftCafe.weightedRating ?? -1;
        const rightWeighted = rightCafe.weightedRating ?? -1;

        if (leftWeighted !== rightWeighted) {
          return rightWeighted - leftWeighted;
        }

        return leftCafe.name.localeCompare(rightCafe.name);
      }

      const leftWeighted = leftCafe.weightedRating ?? -1;
      const rightWeighted = rightCafe.weightedRating ?? -1;

      if (leftWeighted !== rightWeighted) {
        return rightWeighted - leftWeighted;
      }

      if (leftCafe.reviewCount !== rightCafe.reviewCount) {
        return rightCafe.reviewCount - leftCafe.reviewCount;
      }

      return leftCafe.name.localeCompare(rightCafe.name);
    });

    const total = cafesWithComputedScore.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedCafes = cafesWithComputedScore.slice(startIndex, startIndex + pageSize);

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
    await logError("GET /api/cafes/search failed", error, {
      route: "/api/cafes/search",
      method: "GET",
    });
    return NextResponse.json(
      { error: "failed to search cafes" },
      { status: 500 },
    );
  }
}
