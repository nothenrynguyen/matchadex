import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthUser } from "@/lib/auth";
import { getAdminEmails, isAdmin } from "@/lib/admin";
import { importCafeByQuery } from "@/lib/cafes/importByQuery";

type ImportBody = {
  query?: string;
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

  const body = (await request.json()) as ImportBody;
  const query = body.query?.trim();

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googlePlacesApiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is required" }, { status: 500 });
  }

  const result = await importCafeByQuery({
    prisma,
    googlePlacesApiKey,
    query,
  });

  if (!result.imported) {
    return NextResponse.json({ error: "No valid cafe match found for this query." }, { status: 404 });
  }

  return NextResponse.json({
    imported: true,
    cafeName: result.cafeName,
    googlePlaceId: result.googlePlaceId,
  });
}
