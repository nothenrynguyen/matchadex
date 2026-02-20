"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();

        if (data.session?.user) {
          router.replace("/cafes");
          return;
        }
      } catch {
        // swallow session read failures and keep login UI visible
      } finally {
        setIsCheckingSession(false);
      }
    }

    checkSession();
  }, [router]);

  async function handleGoogleLogin() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed");
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <section className="w-full rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-600">Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Login</h1>
        <p className="mt-2 text-sm text-zinc-600">Continue with Google to access MatchaDex.</p>
        <p className="mt-1 text-xs text-zinc-500">
          This sign-in is only used to verify real users and store reviews. Emails are never public.
        </p>
        <p className="mt-1 text-xs text-zinc-500">Contact via GitHub Issues or MatchaDex support.</p>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isSubmitting ? "Redirecting..." : "Sign in with Google"}
        </button>
      </section>
    </main>
  );
}
