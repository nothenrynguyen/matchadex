import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CreateReviewBody = {
  userEmail?: string;
  userName?: string;
  cafeId?: string;
  tasteRating?: number;
  aestheticRating?: number;
  studyRating?: number;
  priceEstimate?: number | null;
  textComment?: string | null;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidRating(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateReviewBody;

    // validate required primitive fields
    const userEmail = body.userEmail?.trim().toLowerCase();
    const userName = body.userName?.trim();
    const cafeId = body.cafeId?.trim();

    if (!userEmail || !isValidEmail(userEmail)) {
      return NextResponse.json({ error: "valid userEmail is required" }, { status: 400 });
    }

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

    // create or load user account from email
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: userName ? { name: userName } : {},
      create: {
        email: userEmail,
        name: userName,
      },
    });

    // enforce one review per user per cafe with upsert
    const review = await prisma.review.upsert({
      where: {
        userId_cafeId: {
          userId: user.id,
          cafeId,
        },
      },
      update: {
        tasteRating: body.tasteRating,
        aestheticRating: body.aestheticRating,
        studyRating: body.studyRating,
        priceEstimate: body.priceEstimate ?? null,
        textComment: body.textComment?.trim() || null,
      },
      create: {
        userId: user.id,
        cafeId,
        tasteRating: body.tasteRating,
        aestheticRating: body.aestheticRating,
        studyRating: body.studyRating,
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
    console.error("POST /api/reviews failed", error);
    return NextResponse.json(
      { error: "failed to save review" },
      { status: 500 },
    );
  }
}
