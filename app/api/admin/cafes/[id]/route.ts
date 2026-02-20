import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthUser } from "@/lib/auth";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";

type UpdateCafeBody = {
  isHidden?: boolean;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  const cafeId = id?.trim();

  if (!cafeId) {
    return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
  }

  const body = (await request.json()) as UpdateCafeBody;

  if (typeof body.isHidden !== "boolean") {
    return NextResponse.json({ error: "isHidden boolean is required" }, { status: 400 });
  }

  try {
    const cafe = await prisma.cafe.update({
      where: { id: cafeId },
      data: {
        isHidden: body.isHidden,
      },
      select: {
        id: true,
        isHidden: true,
      },
    });

    return NextResponse.json({ cafe });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "cafe not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "failed to update cafe visibility" }, { status: 500 });
  }
}
