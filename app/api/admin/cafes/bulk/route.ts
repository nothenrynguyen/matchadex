import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthUser } from "@/lib/auth";
import { getAdminEmails, isAdmin } from "@/lib/admin";

type BulkAction = "delete" | "restore";
type BulkUpdateBody = {
  ids?: string[];
  action?: BulkAction;
};

export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as BulkUpdateBody;
  const ids = Array.from(new Set((body.ids ?? []).map((id) => id.trim()).filter(Boolean)));

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids are required" }, { status: 400 });
  }

  if (body.action !== "delete" && body.action !== "restore") {
    return NextResponse.json({ error: "action must be delete or restore" }, { status: 400 });
  }

  const isHidden = body.action === "delete";

  const result = await prisma.cafe.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      isHidden,
    },
  });

  return NextResponse.json({
    updatedCount: result.count,
    isHidden,
  });
}
