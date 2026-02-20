"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AdminCafe = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  googlePlaceId: string;
  isHidden: boolean;
  createdAt: string;
};

type LoadState = "idle" | "loading" | "error";

export default function AdminCafePanel() {
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [cafes, setCafes] = useState<AdminCafe[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCafes() {
      try {
        setLoadState("loading");
        setErrorMessage(null);

        const params = new URLSearchParams();
        if (normalizedQuery) {
          params.set("q", normalizedQuery);
        }
        if (showHidden) {
          params.set("showHidden", "true");
        }

        const response = await fetch(`/api/admin/cafes?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Failed to load cafes");
        }

        const payload = (await response.json()) as { cafes: AdminCafe[] };
        setCafes(payload.cafes);
        setLoadState("idle");
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load cafes");
      }
    }

    loadCafes();

    return () => {
      controller.abort();
    };
  }, [normalizedQuery, reloadCount, showHidden]);

  async function handleToggleHidden(cafe: AdminCafe) {
    const nextHidden = !cafe.isHidden;

    if (nextHidden) {
      const shouldHide = window.confirm(`Hide "${cafe.name}" from public cafe listings?`);
      if (!shouldHide) {
        return;
      }
    }

    const previousCafes = cafes;
    setCafes((currentCafes) =>
      currentCafes.map((currentCafe) =>
        currentCafe.id === cafe.id
          ? {
              ...currentCafe,
              isHidden: nextHidden,
            }
          : currentCafe,
      ),
    );

    const response = await fetch(`/api/admin/cafes/${encodeURIComponent(cafe.id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isHidden: nextHidden }),
    });

    if (!response.ok) {
      setCafes(previousCafes);
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error ?? "Failed to update cafe visibility");
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReloadCount((currentCount) => currentCount + 1);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Cafe moderation</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Hide/unhide cafes without deleting rows.
        </p>

        <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cafe name, city, or address"
            className="min-w-[260px] rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(event) => setShowHidden(event.target.checked)}
            />
            Show hidden
          </label>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Refresh
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        {loadState === "loading" ? <p className="text-sm text-zinc-600">Loading cafes...</p> : null}
        {loadState === "error" ? (
          <p className="text-sm text-red-600">{errorMessage ?? "Failed to load cafes"}</p>
        ) : null}
        {loadState === "idle" && cafes.length === 0 ? (
          <p className="text-sm text-zinc-600">No cafes found.</p>
        ) : null}

        {cafes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">City</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cafes.map((cafe) => (
                  <tr key={cafe.id}>
                    <td className="px-3 py-3 text-sm text-zinc-900">
                      <p className="font-medium">{cafe.name}</p>
                      <p className="text-xs text-zinc-500">{cafe.address ?? "Address unavailable"}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{cafe.city}</td>
                    <td className="px-3 py-3">
                      {cafe.isHidden ? (
                        <span className="rounded-md bg-zinc-200 px-2 py-1 text-xs text-zinc-700">Hidden</span>
                      ) : (
                        <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Visible</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleHidden(cafe)}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        {cafe.isHidden ? "Unhide" : "Hide"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
