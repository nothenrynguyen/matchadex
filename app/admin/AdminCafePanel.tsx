"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AdminCafe = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  googlePlaceId: string;
  isHidden: boolean;
  reviewCount: number;
  createdAt: string;
};

type LoadState = "idle" | "loading" | "error";
type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export default function AdminCafePanel() {
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [cafes, setCafes] = useState<AdminCafe[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCafeIds, setSelectedCafeIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [importQuery, setImportQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const normalizedImportQuery = useMemo(() => importQuery.trim(), [importQuery]);

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
        params.set("page", String(page));
        params.set("pageSize", "25");

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

        const payload = (await response.json()) as {
          cafes: AdminCafe[];
          pagination: PaginationState;
        };
        setCafes(payload.cafes);
        setPagination(payload.pagination);
        setSelectedCafeIds((currentIds) =>
          currentIds.filter((id) => payload.cafes.some((cafe) => cafe.id === id)),
        );
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
  }, [normalizedQuery, page, reloadCount, showHidden]);

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, showHidden]);

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
      return;
    }

    setActionMessage(`Updated "${cafe.name}".`);
  }

  async function handleRemoveCafe(cafe: AdminCafe) {
    const shouldRemove = window.confirm(
      `Remove "${cafe.name}" from public view? This will hide it instead of deleting data.`,
    );

    if (!shouldRemove) {
      return;
    }

    const previousCafes = cafes;
    setCafes((currentCafes) =>
      currentCafes.map((currentCafe) =>
        currentCafe.id === cafe.id
          ? {
              ...currentCafe,
              isHidden: true,
            }
          : currentCafe,
      ),
    );

    const response = await fetch(`/api/admin/cafes/${encodeURIComponent(cafe.id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setCafes(previousCafes);
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error ?? "Failed to remove cafe");
      return;
    }

    setActionMessage(`Deleted "${cafe.name}" from public listings.`);
  }

  async function handleBulkAction(action: "delete" | "restore") {
    if (selectedCafeIds.length === 0) {
      return;
    }

    const isDelete = action === "delete";
    const shouldProceed = window.confirm(
      isDelete
        ? `Delete ${selectedCafeIds.length} selected cafe(s) from public listings?`
        : `Restore ${selectedCafeIds.length} selected cafe(s) to public listings?`,
    );

    if (!shouldProceed) {
      return;
    }

    const previousCafes = cafes;
    setCafes((currentCafes) =>
      currentCafes.map((cafe) =>
        selectedCafeIds.includes(cafe.id)
          ? {
              ...cafe,
              isHidden: isDelete,
            }
          : cafe,
      ),
    );

    const response = await fetch("/api/admin/cafes/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids: selectedCafeIds,
        action,
      }),
    });

    if (!response.ok) {
      setCafes(previousCafes);
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error ?? "Failed to update selected cafes");
      return;
    }

    setSelectedCafeIds([]);
    setActionMessage(
      isDelete
        ? `Deleted ${selectedCafeIds.length} selected cafe(s).`
        : `Restored ${selectedCafeIds.length} selected cafe(s).`,
    );
  }

  async function handleImportByNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedImportQuery) {
      return;
    }

    try {
      setIsImporting(true);
      setActionMessage(null);

      const response = await fetch("/api/admin/cafes/import-by-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: normalizedImportQuery,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to import cafe by name");
      }

      const payload = (await response.json()) as { cafeName?: string };
      setImportQuery("");
      setReloadCount((currentCount) => currentCount + 1);
      setActionMessage(
        payload.cafeName
          ? `Imported "${payload.cafeName}".`
          : "Imported cafe successfully.",
      );
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to import cafe by name.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReloadCount((currentCount) => currentCount + 1);
  }

  function handleToggleCafeSelection(cafeId: string) {
    setSelectedCafeIds((currentIds) =>
      currentIds.includes(cafeId)
        ? currentIds.filter((currentId) => currentId !== cafeId)
        : [...currentIds, cafeId],
    );
  }

  function handleToggleSelectPage() {
    const cafeIdsOnPage = cafes.map((cafe) => cafe.id);
    const areAllOnPageSelected =
      cafeIdsOnPage.length > 0 && cafeIdsOnPage.every((id) => selectedCafeIds.includes(id));

    if (areAllOnPageSelected) {
      setSelectedCafeIds((currentIds) =>
        currentIds.filter((id) => !cafeIdsOnPage.includes(id)),
      );
      return;
    }

    setSelectedCafeIds((currentIds) => Array.from(new Set([...currentIds, ...cafeIdsOnPage])));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Cafe moderation</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Hide/unhide cafes without deleting rows.
        </p>

        <form onSubmit={handleImportByNameSubmit} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={importQuery}
            onChange={(event) => setImportQuery(event.target.value)}
            placeholder="Import cafe by name (e.g. Kettl Greenpoint)"
            className="min-w-[260px] rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isImporting || normalizedImportQuery.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {isImporting ? "Importing..." : "Import by name"}
          </button>
        </form>

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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleBulkAction("delete")}
            disabled={selectedCafeIds.length === 0}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction("restore")}
            disabled={selectedCafeIds.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Restore selected
          </button>
          <p className="text-xs text-zinc-500">
            {selectedCafeIds.length} selected
          </p>
        </div>

        {actionMessage ? (
          <p className="mt-3 text-sm text-zinc-700">{actionMessage}</p>
        ) : null}
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
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <input
                      type="checkbox"
                      aria-label="Select all cafes on current page"
                      checked={
                        cafes.length > 0 &&
                        cafes.every((cafe) => selectedCafeIds.includes(cafe.id))
                      }
                      onChange={handleToggleSelectPage}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">City</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Reviews</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cafes.map((cafe) => (
                  <tr key={cafe.id}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${cafe.name}`}
                        checked={selectedCafeIds.includes(cafe.id)}
                        onChange={() => handleToggleCafeSelection(cafe.id)}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-900">
                      <p className="font-medium">{cafe.name}</p>
                      <p className="text-xs text-zinc-500">{cafe.address ?? "Address unavailable"}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{cafe.city}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{cafe.reviewCount}</td>
                    <td className="px-3 py-3">
                      {cafe.isHidden ? (
                        <span className="rounded-md bg-zinc-200 px-2 py-1 text-xs text-zinc-700">Hidden</span>
                      ) : (
                        <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Visible</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleHidden(cafe)}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          {cafe.isHidden ? "Unhide" : "Hide"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCafe(cafe)}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete cafe
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <p className="text-xs text-zinc-600">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} cafes)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={!pagination.hasPreviousPage || loadState === "loading"}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={!pagination.hasNextPage || loadState === "loading"}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
