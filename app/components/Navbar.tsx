"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function toDisplayName(email: string) {
  const emailPrefix = email.split("@")[0] ?? "";
  const firstToken = emailPrefix.split(/[._-]/).find(Boolean) ?? emailPrefix;

  if (!firstToken) {
    return "friend";
  }

  return firstToken.toLowerCase();
}

export default function Navbar() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUserEmail(session?.user.email ?? null);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUserEmail(session?.user.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/auth");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!userEmail) {
    return (
      <Link
        href="/auth"
        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-[#eef4eb]"
      >
        Sign in with Google
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-600">Hello, {toDisplayName(userEmail)}</span>
      <Link
        href="/profile"
        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-[#eef4eb]"
      >
        Profile
      </Link>
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
