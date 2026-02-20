import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthUser } from "@/lib/auth";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";

function parseShowHidden(value: string | null) {
  return value === "1" || value?.toLowerCase() === "true";
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

  if (!isAdminEmail(requesterEmail)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const showHidden = parseShowHidden(request.nextUrl.searchParams.get("showHidden"));

  const cafes = await prisma.cafe.findMany({
    where: {
      ...(query.length > 0
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { address: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(showHidden ? {} : { isHidden: false }),
    },
    orderBy: [{ isHidden: "desc" }, { name: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      googlePlaceId: true,
      isHidden: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ cafes });
}
