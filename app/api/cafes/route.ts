import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/monitoring";
import { getCurrentPrismaUser } from "@/lib/auth";

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

  return Array.from(new Set(normalized));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

async function runPrismaQuery<T>(
  label: string,
  operation: () => Promise<T>,
  metadata: Record<string, unknown> = {},
) {
  try {
    return await operation();
  } catch (error) {
    console.error(`[api/cafes] prisma query failed: ${label}`, {
      ...metadata,
      error: toErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const prismaUser = await getCurrentPrismaUser();

    // parse query parameters for filtering and pagination
    const cityFilters = parseCityFilters(request.nextUrl.searchParams);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 6);
    const sort = parseSort(request.nextUrl.searchParams.get("sort"));

    if (page === null) {
      return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
    }

    if (pageSize === null || pageSize > 50) {
      return NextResponse.json(
        { error: "pageSize must be a positive integer up to 50" },
        { status: 400 },
      );
    }

    // load cafes using optional city filters
    const cafes = await runPrismaQuery(
      "cafe.findMany",
      () =>
        prisma.cafe.findMany({
          where: {
            isHidden: false,
            ...(cityFilters.length > 0
              ? {
                  city: { in: cityFilters },
                }
              : {}),
          },
        }),
      { cityFilters },
    );

    const cafeIds = cafes.map((cafe) => cafe.id);

    // aggregate review metrics for each cafe in one query
    const ratingGroups =
      cafeIds.length > 0
        ? await runPrismaQuery(
            "review.groupBy",
            () =>
              prisma.review.groupBy({
                by: ["cafeId"],
                where: { cafeId: { in: cafeIds } },
                _count: { _all: true },
                _avg: {
                  tasteRating: true,
                  aestheticRating: true,
                  studyRating: true,
                },
              }),
            { cafeCount: cafeIds.length },
          )
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

    const cafesWithMetrics = cafes.map((cafe) => ({
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
              await runPrismaQuery(
                "favorite.findMany",
                () =>
                  prisma.favorite.findMany({
                    where: {
                      userId: prismaUser.id,
                      cafeId: { in: pagedCafes.map((cafe) => cafe.id) },
                    },
                    select: { cafeId: true },
                  }),
                { userId: prismaUser.id, pagedCafeCount: pagedCafes.length },
              )
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
    console.error("[api/cafes] request failed", {
      error: toErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await logError("GET /api/cafes failed", error, {
      route: "/api/cafes",
      method: "GET",
    });

    const detailedMessage =
      process.env.NODE_ENV === "development"
        ? `failed to load cafes: ${toErrorMessage(error)}`
        : "failed to load cafes";

    return NextResponse.json(
      { error: detailedMessage },
      { status: 500 },
    );
  }
}
