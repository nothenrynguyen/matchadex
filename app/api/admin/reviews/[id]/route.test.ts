import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentAuthUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    review: {
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/monitoring", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { getCurrentAuthUser } from "@/lib/auth";
import { logInfo } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { DELETE } from "./route";

const prismaMock = prisma as unknown as {
  review: {
    delete: ReturnType<typeof vi.fn>;
  };
};

const getCurrentAuthUserMock = getCurrentAuthUser as ReturnType<typeof vi.fn>;
const logInfoMock = logInfo as ReturnType<typeof vi.fn>;

describe("DELETE /api/admin/reviews/:id", () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = "admin@example.com,owner@example.com";
  });

  afterAll(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("deletes review when requester email is in ADMIN_EMAILS", async () => {
    getCurrentAuthUserMock.mockResolvedValue({
      email: "admin@example.com",
    });
    prismaMock.review.delete.mockResolvedValue({ id: "review-1" });

    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/reviews/review-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "review-1" }),
      },
    );

    const payload = (await response.json()) as { deletedReview: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.deletedReview.id).toBe("review-1");
    expect(prismaMock.review.delete).toHaveBeenCalledWith({
      where: { id: "review-1" },
    });
    expect(logInfoMock).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when requester is not admin", async () => {
    getCurrentAuthUserMock.mockResolvedValue({
      email: "user@example.com",
    });

    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/reviews/review-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ id: "review-1" }),
      },
    );

    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("forbidden");
    expect(prismaMock.review.delete).not.toHaveBeenCalled();
  });
});
