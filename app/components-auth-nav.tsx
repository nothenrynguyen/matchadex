"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AuthNavProps = {
  userEmail: string | null;
  prismaUserId: string | null;
};

export default function AuthNav({ userEmail, prismaUserId }: AuthNavProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setIsLoggingOut(false);
      router.push("/auth");
      router.refresh();
    }
  }

  if (!userEmail) {
    return (
      <Link
        href="/auth"
        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-[#eef4eb]"
      >
        Login / Sign up
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {prismaUserId ? (
        <Link
          href={`/users/${prismaUserId}`}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Profile
        </Link>
      ) : null}
      <span className="text-sm text-zinc-600">{userEmail}</span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-[#eef4eb] disabled:opacity-60"
      >
        {isLoggingOut ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
