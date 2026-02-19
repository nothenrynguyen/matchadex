import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentPrismaUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    review: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getCurrentPrismaUser } from "@/lib/auth";
import { DELETE } from "./route";

const prismaMock = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  review: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const getCurrentPrismaUserMock = getCurrentPrismaUser as ReturnType<typeof vi.fn>;

describe("DELETE /api/reviews/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getCurrentPrismaUserMock.mockResolvedValue({
      id: "user-1",
    });
  });

  it("deletes review for owner", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.review.findUnique.mockResolvedValue({ id: "review-1", userId: "user-1" });
    prismaMock.review.delete.mockResolvedValue({ id: "review-1" });

    const response = await DELETE(new Request("http://localhost:3000/api/reviews/review-1"), {
      params: Promise.resolve({ id: "review-1" }),
    });

    const payload = (await response.json()) as { deletedReview: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.deletedReview.id).toBe("review-1");
  });

  it("returns 403 for non-owner", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.review.findUnique.mockResolvedValue({ id: "review-1", userId: "user-2" });

    const response = await DELETE(new Request("http://localhost:3000/api/reviews/review-1"), {
      params: Promise.resolve({ id: "review-1" }),
    });

    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("forbidden");
  });
});
