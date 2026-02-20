import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthUser } from "@/lib/auth";
import { getAdminEmails, isAdmin } from "@/lib/admin";

function parseShowHidden(value: string | null) {
  return value === "1" || value?.toLowerCase() === "true";
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

export async function GET(request: NextRequest) {
  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    return NextResponse.json({ error: "admin email list is not configured" }, { status: 500 });
  }

  const authUser = await getCurrentAuthUser();
  const requesterEmail = authUser?.email?.trim().toLowerCase();

  if (!requesterEmail) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isAdmin(requesterEmail)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const showHidden = parseShowHidden(request.nextUrl.searchParams.get("showHidden"));
  const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 25);

  if (page === null) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  if (pageSize === null || pageSize > 100) {
    return NextResponse.json(
      { error: "pageSize must be a positive integer up to 100" },
      { status: 400 },
    );
  }

  const where = {
    ...(query.length > 0
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { address: { contains: query, mode: "insensitive" as const } },
            { city: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(showHidden ? {} : { isHidden: false }),
  };

  const total = await prisma.cafe.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;

  const cafes = await prisma.cafe.findMany({
    where,
    orderBy: [{ isHidden: "desc" }, { name: "asc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      googlePlaceId: true,
      isHidden: true,
      createdAt: true,
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });

  return NextResponse.json({
    cafes: cafes.map(({ _count, ...cafe }) => ({
      ...cafe,
      reviewCount: _count.reviews,
    })),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  });
}
