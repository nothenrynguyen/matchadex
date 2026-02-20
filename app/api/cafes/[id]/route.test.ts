import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentPrismaUser: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cafe: {
      findUnique: vi.fn(),
    },
    review: {
      aggregate: vi.fn(),
    },
    favorite: {
      findUnique: vi.fn(),
    },
  },
}));

import { getCurrentPrismaUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const prismaMock = prisma as unknown as {
  cafe: { findUnique: ReturnType<typeof vi.fn> };
  review: { aggregate: ReturnType<typeof vi.fn> };
  favorite: { findUnique: ReturnType<typeof vi.fn> };
};
const getCurrentPrismaUserMock = getCurrentPrismaUser as ReturnType<typeof vi.fn>;
const isCurrentUserAdminMock = isCurrentUserAdmin as ReturnType<typeof vi.fn>;

describe("GET /api/cafes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentPrismaUserMock.mockResolvedValue(null);
    isCurrentUserAdminMock.mockResolvedValue(false);
    prismaMock.favorite.findUnique.mockResolvedValue(null);
  });

  it("returns null average ratings when a cafe has no reviews", async () => {
    prismaMock.cafe.findUnique.mockResolvedValue({
      id: "cafe-1",
      name: "Cafe One",
      address: "Addr",
      city: "LA",
      googlePlaceId: "gp-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      reviews: [],
    });

    prismaMock.review.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _avg: {
        tasteRating: null,
        aestheticRating: null,
        studyRating: null,
      },
    });

    const response = await GET(new Request("http://localhost:3000/api/cafes/cafe-1"), {
      params: Promise.resolve({ id: "cafe-1" }),
    });

    const payload = (await response.json()) as {
      cafe: {
        averageRatings: {
          reviewCount: number;
          tasteRating: number | null;
          aestheticRating: number | null;
          studyRating: number | null;
          overallRating: number | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.cafe.averageRatings.reviewCount).toBe(0);
    expect(payload.cafe.averageRatings.tasteRating).toBeNull();
    expect(payload.cafe.averageRatings.aestheticRating).toBeNull();
    expect(payload.cafe.averageRatings.studyRating).toBeNull();
    expect(payload.cafe.averageRatings.overallRating).toBeNull();
  });

  it("returns 404 for hidden cafes when requester is not admin", async () => {
    prismaMock.cafe.findUnique.mockResolvedValue({
      id: "cafe-hidden",
      isHidden: true,
      reviews: [],
    });

    const response = await GET(new Request("http://localhost:3000/api/cafes/cafe-hidden"), {
      params: Promise.resolve({ id: "cafe-hidden" }),
    });

    expect(response.status).toBe(404);
  });
});
