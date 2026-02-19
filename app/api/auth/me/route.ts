import { NextResponse } from "next/server";
import { getCurrentAuthUser, getCurrentPrismaUser } from "@/lib/auth";

export async function GET() {
  try {
    const authUser = await getCurrentAuthUser();
    const prismaUser = await getCurrentPrismaUser();

    return NextResponse.json({
      user: authUser
        ? {
            id: authUser.id,
            email: authUser.email ?? null,
            prismaUserId: prismaUser?.id ?? null,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to load session" },
      { status: 500 },
    );
  }
}
