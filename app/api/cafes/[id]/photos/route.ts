import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/monitoring";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getCafePhotosBucketName, getSupabaseAdminClient } from "@/lib/supabase/admin";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").toLowerCase();
}

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const cafeId = id?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
    }

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { id: true } });

    if (!cafe) {
      return NextResponse.json({ error: "cafe not found" }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const bucketName = getCafePhotosBucketName();

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .list(cafeId, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const photos = (data || [])
      .filter((item) => !item.name.endsWith("/"))
      .map((item) => {
        const path = `${cafeId}/${item.name}`;
        const { data: publicUrlData } = supabaseAdmin.storage
          .from(bucketName)
          .getPublicUrl(path);

        return {
          name: item.name,
          path,
          publicUrl: publicUrlData.publicUrl,
          createdAt: item.created_at,
        };
      });

    return NextResponse.json({ photos });
  } catch (error) {
    await logError("GET /api/cafes/[id]/photos failed", error, {
      route: "/api/cafes/[id]/photos",
      method: "GET",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to load photos" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentPrismaUser({ createIfMissing: true });

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const cafeId = id?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
    }

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { id: true } });

    if (!cafe) {
      return NextResponse.json({ error: "cafe not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "file must be an image" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "image must be 5MB or smaller" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${cafeId}/${Date.now()}-${safeFileName(file.name || "upload.jpg")}`;

    const supabaseAdmin = getSupabaseAdminClient();
    const bucketName = getCafePhotosBucketName();

    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({
      photo: {
        path: filePath,
        publicUrl: publicUrlData.publicUrl,
      },
    });
  } catch (error) {
    await logError("POST /api/cafes/[id]/photos failed", error, {
      route: "/api/cafes/[id]/photos",
      method: "POST",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to upload photo" },
      { status: 500 },
    );
  }
}
