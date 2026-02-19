import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const authUser = await getCurrentAuthUser();

    return NextResponse.json({
      loggedIn: Boolean(authUser),
      email: authUser?.email ?? null,
    });
  } catch {
    return NextResponse.json(
      {
        loggedIn: false,
        email: null,
      },
      { status: 500 },
    );
  }
}
