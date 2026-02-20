import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentPrismaUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cafe: {
      findUnique: vi.fn(),
    },
    user: {
      upsert: vi.fn(),
    },
    review: {
      upsert: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getCurrentPrismaUser } from "@/lib/auth";
import { POST } from "./route";

const prismaMock = prisma as unknown as {
  cafe: { findUnique: ReturnType<typeof vi.fn> };
  user: { upsert: ReturnType<typeof vi.fn> };
  review: {
    upsert: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
};

const getCurrentPrismaUserMock = getCurrentPrismaUser as ReturnType<typeof vi.fn>;

describe("POST /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getCurrentPrismaUserMock.mockResolvedValue({
      id: "user-1",
    });
  });

  it("creates or updates review and returns averages", async () => {
    prismaMock.cafe.findUnique.mockResolvedValue({ id: "cafe-1" });
    prismaMock.review.upsert.mockResolvedValue({
      id: "review-1",
      userId: "user-1",
      cafeId: "cafe-1",
    });
    prismaMock.review.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _avg: { tasteRating: 4, aestheticRating: 4.5, studyRating: 5 },
    });

    const request = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        userName: "Test",
        cafeId: "cafe-1",
        tasteRating: 5,
        aestheticRating: 4,
        studyRating: 5,
        textComment: "Great",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      review: { id: string };
      averageRatings: { reviewCount: number; overallRating: number | null };
    };

    expect(response.status).toBe(201);
    expect(payload.review.id).toBe("review-1");
    expect(payload.averageRatings.reviewCount).toBe(3);
    expect(payload.averageRatings.overallRating).toBe(4.5);
    expect(prismaMock.review.upsert).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid rating", async () => {
    const request = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        cafeId: "cafe-1",
        tasteRating: 6,
        aestheticRating: 4,
        studyRating: 5,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("tasteRating");
  });

  it("returns 401 when user is not authenticated", async () => {
    getCurrentPrismaUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        cafeId: "cafe-1",
        tasteRating: 5,
        aestheticRating: 4,
        studyRating: 5,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("unauthorized");
  });
});
