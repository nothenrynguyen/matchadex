"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Toast from "@/app/components/toast";

type SortOption = "rating_desc" | "rating_asc" | "name_asc" | "name_desc";

type Cafe = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  googlePlaceId: string;
  createdAt: string;
  averageRatings: {
    reviewCount: number;
    tasteRating: number | null;
    aestheticRating: number | null;
    studyRating: number | null;
    overallRating: number | null;
  };
  isFavorited: boolean;
};

type PaginatedCafeResponse = {
  cafes: Cafe[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  sort: SortOption;
};

type ReviewFormState = {
  userName: string;
  tasteRating: string;
  aestheticRating: string;
  studyRating: string;
  priceEstimate: string;
  textComment: string;
};

type ViewMode = "list" | "map";

const cityOptions = ["All", "LA", "OC", "Bay Area", "Seattle", "NYC"];

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "rating_desc", label: "Rating: High to low" },
  { value: "rating_asc", label: "Rating: Low to high" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

const initialReviewFormState: ReviewFormState = {
  userName: "",
  tasteRating: "5",
  aestheticRating: "5",
  studyRating: "5",
  priceEstimate: "",
  textComment: "",
};

function ratingText(value: number | null) {
  return value === null ? "N/A" : value.toFixed(1);
}

function toAverage(value: number) {
  return Number(value.toFixed(2));
}

function optimisticAverage(
  currentAverage: number | null,
  currentCount: number,
  incomingRating: number,
) {
  if (currentAverage === null || currentCount === 0) {
    return incomingRating;
  }

  return toAverage((currentAverage * currentCount + incomingRating) / (currentCount + 1));
}

function updateCafeOptimistically(cafe: Cafe, incomingRatings: { taste: number; aesthetic: number; study: number }) {
  const currentCount = cafe.averageRatings.reviewCount;

  const tasteRating = optimisticAverage(cafe.averageRatings.tasteRating, currentCount, incomingRatings.taste);
  const aestheticRating = optimisticAverage(
    cafe.averageRatings.aestheticRating,
    currentCount,
    incomingRatings.aesthetic,
  );
  const studyRating = optimisticAverage(cafe.averageRatings.studyRating, currentCount, incomingRatings.study);
  const overallRating = toAverage((tasteRating + aestheticRating + studyRating) / 3);

  return {
    ...cafe,
    averageRatings: {
      ...cafe.averageRatings,
      reviewCount: currentCount + 1,
      tasteRating,
      aestheticRating,
      studyRating,
      overallRating,
    },
  };
}

function CafeCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-5">
      <div className="h-5 w-48 rounded bg-zinc-200" />
      <div className="mt-2 h-4 w-72 rounded bg-zinc-100" />
      <div className="mt-4 h-4 w-32 rounded bg-zinc-100" />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="h-4 rounded bg-zinc-100" />
        <div className="h-4 rounded bg-zinc-100" />
        <div className="h-4 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

function CafesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [city, setCity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("rating_desc");
  const [page, setPage] = useState(1);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginatedCafeResponse["pagination"]>({
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [modalCafeId, setModalCafeId] = useState<string | null>(null);
  const [reviewFormState, setReviewFormState] = useState(initialReviewFormState);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const normalizedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);
  const metroFromQuery = searchParams.get("metro");

  useEffect(() => {
    if (!metroFromQuery) {
      return;
    }

    if (cityOptions.includes(metroFromQuery) && metroFromQuery !== city) {
      setCity(metroFromQuery);
    }
  }, [metroFromQuery, city]);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          user: { email: string | null; prismaUserId: string | null } | null;
        };

        setSessionUserEmail(payload.user?.email ?? null);
      } catch {
        setSessionUserEmail(null);
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [city, normalizedQuery, sort]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCafes() {
      try {
        setIsLoading(true);
        setListError(null);

        // query API with server-side pagination and sorting
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "6",
          sort,
        });

        if (city !== "All") {
          params.set("city", city);
        }

        if (normalizedQuery) {
          params.set("q", normalizedQuery);
        }

        const endpoint = normalizedQuery
          ? `/api/cafes/search?${params.toString()}`
          : `/api/cafes?${params.toString()}`;

        const response = await fetch(endpoint, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Failed to load cafes");
        }

        const payload = (await response.json()) as PaginatedCafeResponse;
        setCafes(payload.cafes);
        setPagination(payload.pagination);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setListError(error instanceof Error ? error.message : "Failed to load cafes");
          setCafes([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    const timeoutId = setTimeout(loadCafes, 220);

    // cancel stale requests when filters are changed rapidly
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [city, normalizedQuery, sort, page]);

  useEffect(() => {
    if (!toastState) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setToastState(null);
    }, 2500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [toastState]);

  useEffect(() => {
    if (!modalCafeId) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalCafeId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalCafeId]);

  async function handleToggleFavorite(cafeId: string, nextIsFavorited: boolean) {
    if (!sessionUserEmail) {
      router.push("/auth");
      return;
    }

    const previousCafes = cafes;

    setCafes((currentCafes) =>
      currentCafes.map((cafe) =>
        cafe.id === cafeId ? { ...cafe, isFavorited: nextIsFavorited } : cafe,
      ),
    );

    try {
      const response = await fetch(`/api/cafes/${encodeURIComponent(cafeId)}/favorite`, {
        method: nextIsFavorited ? "POST" : "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to update favorite");
      }

      setToastState({
        message: nextIsFavorited ? "Added to favorites." : "Removed from favorites.",
        tone: "success",
      });
    } catch (error) {
      setCafes(previousCafes);
      setToastState({
        message: error instanceof Error ? error.message : "Failed to update favorite.",
        tone: "error",
      });
    }
  }

  async function handleSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modalCafeId || !sessionUserEmail) {
      setReviewError("You must be logged in to submit a review.");
      return;
    }

    const tasteRating = Number(reviewFormState.tasteRating);
    const aestheticRating = Number(reviewFormState.aestheticRating);
    const studyRating = Number(reviewFormState.studyRating);

    const previousCafes = cafes;

    // apply optimistic rating update immediately for responsiveness
    setCafes((currentCafes) =>
      currentCafes.map((cafe) =>
        cafe.id === modalCafeId
          ? updateCafeOptimistically(cafe, {
              taste: tasteRating,
              aesthetic: aestheticRating,
              study: studyRating,
            })
          : cafe,
      ),
    );

    try {
      setIsSubmittingReview(true);
      setReviewError(null);
      setReviewSuccess(null);

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName: reviewFormState.userName,
          cafeId: modalCafeId,
          tasteRating,
          aestheticRating,
          studyRating,
          priceEstimate: reviewFormState.priceEstimate ? Number(reviewFormState.priceEstimate) : null,
          textComment: reviewFormState.textComment || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to save review");
      }

      const payload = (await response.json()) as {
        averageRatings: Cafe["averageRatings"];
      };

      // reconcile optimistic state with server-truth aggregate values
      setCafes((currentCafes) =>
        currentCafes.map((cafe) =>
          cafe.id === modalCafeId
            ? {
                ...cafe,
                averageRatings: payload.averageRatings,
              }
            : cafe,
        ),
      );

      setReviewSuccess("Review saved.");
      setReviewFormState(initialReviewFormState);
      setModalCafeId(null);
    } catch (error) {
      // roll back optimistic mutation if save fails
      setCafes(previousCafes);
      setReviewError(error instanceof Error ? error.message : "Failed to save review");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">MatchaDex Cafes</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Browse cafes by city, sort by rating, and manage your reviews.
            </p>
          </div>
          <Link
            href="/cafes/leaderboard"
            className="w-fit rounded-lg border border-emerald-200 bg-[#eef4eb] px-3 py-2 text-sm text-emerald-900 hover:bg-[#e3ecdf]"
          >
            View leaderboard
          </Link>
        </div>
      </section>

      <section className="mb-6 grid gap-3 rounded-2xl border border-emerald-100 bg-[#f3f1e7] p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm text-zinc-700">
          City
          <select
            aria-label="Filter cafes by city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
          >
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-zinc-700">
          Search cafe name
          <input
            aria-label="Search cafe name"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="matcha"
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-zinc-700">
          Sort
          <select
            aria-label="Sort cafe list"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-zinc-700">
          View
          <select
            aria-label="Switch list or map view"
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as ViewMode)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
          >
            <option value="list">List</option>
            <option value="map">Map</option>
          </select>
        </label>
      </section>

      {listError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
        </div>
      ) : null}

      {reviewSuccess ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {reviewSuccess}
        </div>
      ) : null}

      {isLoading ? (
        <section className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CafeCardSkeleton key={`skeleton-${index + 1}`} />
          ))}
        </section>
      ) : null}

      {!isLoading && !listError && cafes.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No cafes found for this filter.
        </div>
      ) : null}

      {!isLoading && cafes.length > 0 && viewMode === "list" ? (
        <section className="grid gap-4">
          {cafes.map((cafe) => (
            <article key={cafe.id} className="rounded-2xl border border-emerald-100 bg-[#fffdf6] p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{cafe.name}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{cafe.address ?? "Address unavailable"}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{cafe.city}</p>
                  <Link
                    href={`/cafes/${cafe.id}`}
                    className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    View cafe details
                  </Link>
                </div>

                <div className="rounded-lg bg-[#eef4eb] px-3 py-2 text-sm text-zinc-700">
                  <p>
                    Overall: <span className="font-semibold">{ratingText(cafe.averageRatings.overallRating)}</span>
                  </p>
                  <p className="text-xs text-zinc-500">{cafe.averageRatings.reviewCount} reviews</p>
                </div>
              </div>

              <div className="mt-3 grid gap-1 text-sm text-zinc-600 sm:grid-cols-3">
                <p>Taste: {ratingText(cafe.averageRatings.tasteRating)}</p>
                <p>Aesthetic: {ratingText(cafe.averageRatings.aestheticRating)}</p>
                <p>Study: {ratingText(cafe.averageRatings.studyRating)}</p>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!sessionUserEmail) {
                        router.push("/auth");
                        return;
                      }

                      setModalCafeId(cafe.id);
                      setReviewError(null);
                      setReviewSuccess(null);
                    }}
                    aria-label={`Write or edit review for ${cafe.name}`}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Write / Edit review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(cafe.id, !cafe.isFavorited)}
                    aria-label={
                      cafe.isFavorited
                        ? `Remove ${cafe.name} from favorites`
                        : `Add ${cafe.name} to favorites`
                    }
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      cafe.isFavorited
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {cafe.isFavorited ? "Favorited" : "Add favorite"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!isLoading && cafes.length > 0 && viewMode === "map" ? (
        <section className="grid gap-4">
          {cafes.map((cafe) => (
            <article key={`map-${cafe.id}`} className="rounded-2xl border border-emerald-100 bg-[#fffdf6] p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">{cafe.name}</h2>
                  <p className="text-sm text-zinc-600">{cafe.address ?? "Address unavailable"}</p>
                </div>
                <Link
                  href={`/cafes/${cafe.id}`}
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Open detail
                </Link>
              </div>
              <iframe
                title={`${cafe.name} map`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${cafe.name} ${cafe.address ?? cafe.city}`,
                )}&output=embed`}
                className="h-64 w-full rounded-lg border border-emerald-100"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </article>
          ))}
        </section>
      ) : null}

      <section className="mt-6 flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-600">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} cafes)
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={!pagination.hasPreviousPage || isLoading}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage + 1)}
            disabled={!pagination.hasNextPage || isLoading}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>

      {modalCafeId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Write or edit review modal"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Write or edit your review</h3>
              <button
                type="button"
                onClick={() => setModalCafeId(null)}
                className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="grid gap-3">
              {sessionUserEmail ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  Posting as {sessionUserEmail}
                </p>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  You must login before posting a review.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-1">
                <input
                  aria-label="Your display name"
                  value={reviewFormState.userName}
                  onChange={(event) =>
                    setReviewFormState((current) => ({
                      ...current,
                      userName: event.target.value,
                    }))
                  }
                  placeholder="Your name (optional)"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <input
                  aria-label="Taste rating from 1 to 5"
                  value={reviewFormState.tasteRating}
                  onChange={(event) =>
                    setReviewFormState((current) => ({
                      ...current,
                      tasteRating: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  max={5}
                  placeholder="Taste (1-5)"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
                  required
                />
                <input
                  aria-label="Aesthetic rating from 1 to 5"
                  value={reviewFormState.aestheticRating}
                  onChange={(event) =>
                    setReviewFormState((current) => ({
                      ...current,
                      aestheticRating: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  max={5}
                  placeholder="Aesthetic (1-5)"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
                  required
                />
                <input
                  aria-label="Study rating from 1 to 5"
                  value={reviewFormState.studyRating}
                  onChange={(event) =>
                    setReviewFormState((current) => ({
                      ...current,
                      studyRating: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  max={5}
                  placeholder="Study (1-5)"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
                  required
                />
                <input
                  aria-label="Price estimate"
                  value={reviewFormState.priceEstimate}
                  onChange={(event) =>
                    setReviewFormState((current) => ({
                      ...current,
                      priceEstimate: event.target.value,
                    }))
                  }
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price estimate"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
                />
              </div>

              <textarea
                aria-label="Review comment"
                value={reviewFormState.textComment}
                onChange={(event) =>
                  setReviewFormState((current) => ({
                    ...current,
                    textComment: event.target.value,
                  }))
                }
                placeholder="Optional comment"
                maxLength={500}
                className="min-h-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
              />

              {reviewError ? <p className="text-sm text-red-600">{reviewError}</p> : null}

              <button
                type="submit"
                disabled={isSubmittingReview || !sessionUserEmail}
                className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {isSubmittingReview ? "Saving..." : "Save review"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
      {toastState ? (
        <Toast
          message={toastState.message}
          tone={toastState.tone}
          onClose={() => setToastState(null)}
        />
      ) : null}
    </main>
  );
}

export default function CafesPage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">Loading cafes...</main>}>
      <CafesPageContent />
    </Suspense>
  );
}
