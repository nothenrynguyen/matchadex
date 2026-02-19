import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/monitoring";
import { getCurrentPrismaUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

type CreateReviewBody = {
  userName?: string;
  cafeId?: string;
  tasteRating?: number;
  aestheticRating?: number;
  studyRating?: number;
  priceEstimate?: number | null;
  textComment?: string | null;
};

function isValidRating(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const rateLimitResult = enforceRateLimit({
      key: `reviews:post:${clientIp}`,
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "too many requests, please try again shortly" },
        { status: 429 },
      );
    }

    const body = (await request.json()) as CreateReviewBody;
    const userName = body.userName?.trim();
    const user = await getCurrentPrismaUser({
      createIfMissing: true,
      userName,
    });

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // validate required primitive fields
    const cafeId = body.cafeId?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafeId is required" }, { status: 400 });
    }

    if (!isValidRating(body.tasteRating)) {
      return NextResponse.json({ error: "tasteRating must be an integer from 1 to 5" }, { status: 400 });
    }

    if (!isValidRating(body.aestheticRating)) {
      return NextResponse.json({ error: "aestheticRating must be an integer from 1 to 5" }, { status: 400 });
    }

    if (!isValidRating(body.studyRating)) {
      return NextResponse.json({ error: "studyRating must be an integer from 1 to 5" }, { status: 400 });
    }

    if (
      body.priceEstimate !== undefined &&
      body.priceEstimate !== null &&
      (typeof body.priceEstimate !== "number" || body.priceEstimate < 0)
    ) {
      return NextResponse.json({ error: "priceEstimate must be a positive number" }, { status: 400 });
    }

    if (
      body.textComment !== undefined &&
      body.textComment !== null &&
      body.textComment.trim().length > 500
    ) {
      return NextResponse.json({ error: "textComment must be 500 characters or less" }, { status: 400 });
    }

    // ensure the cafe exists before creating review rows
    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId } });

    if (!cafe) {
      return NextResponse.json({ error: "cafe not found" }, { status: 404 });
    }

    const tasteRating = body.tasteRating as number;
    const aestheticRating = body.aestheticRating as number;
    const studyRating = body.studyRating as number;

    // enforce one review per user per cafe with upsert
    const review = await prisma.review.upsert({
      where: {
        userId_cafeId: {
          userId: user.id,
          cafeId,
        },
      },
      update: {
        tasteRating,
        aestheticRating,
        studyRating,
        priceEstimate: body.priceEstimate ?? null,
        textComment: body.textComment?.trim() || null,
      },
      create: {
        userId: user.id,
        cafeId,
        tasteRating,
        aestheticRating,
        studyRating,
        priceEstimate: body.priceEstimate ?? null,
        textComment: body.textComment?.trim() || null,
      },
    });

    // compute updated average ratings for this cafe
    const ratingAggregate = await prisma.review.aggregate({
      where: { cafeId },
      _count: { _all: true },
      _avg: {
        tasteRating: true,
        aestheticRating: true,
        studyRating: true,
      },
    });

    return NextResponse.json(
      {
        review,
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
      { status: 201 },
    );
  } catch (error) {
    await logError("POST /api/reviews failed", error, {
      route: "/api/reviews",
      method: "POST",
    });
    return NextResponse.json(
      { error: "failed to save review" },
      { status: 500 },
    );
  }
}
