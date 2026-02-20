import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentPrismaUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cafe: {
      findMany: vi.fn(),
    },
    review: {
      groupBy: vi.fn(),
    },
    favorite: {
      findMany: vi.fn(),
    },
  },
}));

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const prismaMock = prisma as unknown as {
  cafe: { findMany: ReturnType<typeof vi.fn> };
  review: { groupBy: ReturnType<typeof vi.fn> };
  favorite: { findMany: ReturnType<typeof vi.fn> };
};
const getCurrentPrismaUserMock = getCurrentPrismaUser as ReturnType<typeof vi.fn>;

describe("GET /api/cafes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentPrismaUserMock.mockResolvedValue(null);
  });

  it("returns paginated cafes sorted by weighted rating", async () => {
    prismaMock.cafe.findMany.mockResolvedValue([
      {
        id: "cafe-1",
        name: "Cafe One",
        city: "LA",
        address: "Addr 1",
        googlePlaceId: "gp-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "cafe-2",
        name: "Cafe Two",
        city: "LA",
        address: "Addr 2",
        googlePlaceId: "gp-2",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "cafe-3",
        name: "Cafe Three",
        city: "LA",
        address: "Addr 3",
        googlePlaceId: "gp-3",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    prismaMock.review.groupBy.mockResolvedValue([
      {
        cafeId: "cafe-1",
        _count: { _all: 2 },
        _avg: { tasteRating: 4, aestheticRating: 4, studyRating: 5 },
      },
      {
        cafeId: "cafe-2",
        _count: { _all: 1 },
        _avg: { tasteRating: 3, aestheticRating: 3, studyRating: 3 },
      },
      {
        cafeId: "cafe-3",
        _count: { _all: 0 },
        _avg: { tasteRating: null, aestheticRating: null, studyRating: null },
      },
    ]);

    const request = new NextRequest("http://localhost:3000/api/cafes?city=LA&page=1&pageSize=2&sort=rating");

    const response = await GET(request);
    const payload = (await response.json()) as {
      cafes: Array<{ id: string; weightedRating: number | null; reviewCount: number }>;
      pagination: { total: number; totalPages: number; page: number };
      sort: string;
    };

    expect(response.status).toBe(200);
    expect(payload.sort).toBe("rating");
    expect(payload.pagination).toEqual({
      total: 3,
      totalPages: 2,
      page: 1,
      pageSize: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(payload.cafes).toHaveLength(2);
    expect(payload.cafes[0].id).toBe("cafe-1");
    expect(payload.cafes[1].id).toBe("cafe-2");
    expect(payload.cafes.find((cafe) => cafe.id === "cafe-1")?.weightedRating).not.toBeNull();
  });

  it("returns null rating for cafes with zero reviews (N/A state)", async () => {
    prismaMock.cafe.findMany.mockResolvedValue([
      {
        id: "cafe-empty",
        name: "Cafe Empty",
        city: "LA",
        address: "Addr",
        googlePlaceId: "gp-empty",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    prismaMock.review.groupBy.mockResolvedValue([]);

    const request = new NextRequest("http://localhost:3000/api/cafes?city=LA&page=1&pageSize=12&sort=rating");

    const response = await GET(request);
    const payload = (await response.json()) as {
      cafes: Array<{ id: string; weightedRating: number | null; reviewCount: number }>;
    };

    expect(response.status).toBe(200);
    expect(payload.cafes[0].reviewCount).toBe(0);
    expect(payload.cafes[0].weightedRating).toBeNull();
  });

  it("supports multiple city filters", async () => {
    prismaMock.cafe.findMany.mockResolvedValue([]);
    prismaMock.review.groupBy.mockResolvedValue([]);

    const request = new NextRequest("http://localhost:3000/api/cafes?city=LA&city=OC&page=1&pageSize=12");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prismaMock.cafe.findMany).toHaveBeenCalledWith({
      where: {
        city: {
          in: ["LA", "OC"],
        },
      },
    });
  });

  it("returns 400 for invalid pagination params", async () => {
    const request = new NextRequest("http://localhost:3000/api/cafes?page=0");

    const response = await GET(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("page must be a positive integer");
  });
});
