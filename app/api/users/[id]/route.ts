import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPrismaUser } from "@/lib/auth";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await getCurrentPrismaUser();
    const { id } = await context.params;
    const userId = id?.trim();

    if (!userId) {
      return NextResponse.json({ error: "user id is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        reviews: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            cafeId: true,
            tasteRating: true,
            aestheticRating: true,
            studyRating: true,
            textComment: true,
            updatedAt: true,
            cafe: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
        favorites: {
          orderBy: { createdAt: "desc" },
          include: {
            cafe: {
              select: {
                id: true,
                name: true,
                city: true,
                address: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    return NextResponse.json({
      user,
      canManageReviews: viewer?.id === user.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to load user" },
      { status: 500 },
    );
  }
}
