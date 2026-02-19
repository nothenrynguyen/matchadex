import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPrismaUser } from "@/lib/auth";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentPrismaUser();
    const { id } = await context.params;
    const cafeId = id?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ isFavorited: false });
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_cafeId: {
          userId: user.id,
          cafeId,
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ isFavorited: Boolean(favorite) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to load favorite" },
      { status: 500 },
    );
  }
}

export async function POST(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentPrismaUser({ createIfMissing: true });
    const { id } = await context.params;
    const cafeId = id?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { id: true } });

    if (!cafe) {
      return NextResponse.json({ error: "cafe not found" }, { status: 404 });
    }

    await prisma.favorite.upsert({
      where: {
        userId_cafeId: {
          userId: user.id,
          cafeId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        cafeId,
      },
    });

    return NextResponse.json({ isFavorited: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to favorite cafe" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentPrismaUser();
    const { id } = await context.params;
    const cafeId = id?.trim();

    if (!cafeId) {
      return NextResponse.json({ error: "cafe id is required" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: user.id,
        cafeId,
      },
    });

    return NextResponse.json({ isFavorited: false });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to unfavorite cafe" },
      { status: 500 },
    );
  }
}
