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

describe("GET /api/cafes/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentPrismaUserMock.mockResolvedValue(null);
  });

  it("matches cafe names diacritic-insensitively", async () => {
    prismaMock.cafe.findMany.mockResolvedValue([
      {
        id: "cafe-phe",
        name: "Phê House",
        city: "NYC",
        address: "1 Main St",
        googlePlaceId: "gp-phe",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "cafe-other",
        name: "Matcha Corner",
        city: "NYC",
        address: "2 Main St",
        googlePlaceId: "gp-other",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    prismaMock.review.groupBy.mockResolvedValue([]);
    prismaMock.favorite.findMany.mockResolvedValue([]);

    const request = new NextRequest("http://localhost:3000/api/cafes/search?q=phe&page=1&pageSize=12");
    const response = await GET(request);
    const payload = (await response.json()) as {
      cafes: Array<{ id: string; name: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.cafes).toHaveLength(1);
    expect(payload.cafes[0].id).toBe("cafe-phe");
  });
});
