"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function resolveAuthCallback() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session?.user) {
          setErrorMessage("Login failed. Please try again.");
          return;
        }

        router.replace("/cafes");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Login failed. Please try again.");
      }
    }

    resolveAuthCallback();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Completing login</h1>
        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">Signing you in with Google...</p>
        )}
      </section>
    </main>
  );
}
