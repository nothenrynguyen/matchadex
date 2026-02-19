"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
};

type ReviewFormState = {
  userEmail: string;
  userName: string;
  tasteRating: string;
  aestheticRating: string;
  studyRating: string;
  priceEstimate: string;
  textComment: string;
};

const cityOptions = ["All", "LA", "OC", "Bay Area", "Seattle", "NYC"];

const initialReviewFormState: ReviewFormState = {
  userEmail: "",
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

export default function CafesPage() {
  const [city, setCity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [activeReviewCafeId, setActiveReviewCafeId] = useState<string | null>(null);
  const [reviewFormState, setReviewFormState] = useState(initialReviewFormState);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCafes() {
      try {
        setIsLoading(true);
        setListError(null);

        // select endpoint based on whether search query exists
        const endpoint = normalizedQuery
          ? `/api/cafes/search?q=${encodeURIComponent(normalizedQuery)}`
          : city === "All"
            ? "/api/cafes"
            : `/api/cafes?city=${encodeURIComponent(city)}`;

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

        const payload = (await response.json()) as { cafes: Cafe[] };

        // when searching, keep city filtering active on the client
        const filteredCafes =
          normalizedQuery && city !== "All"
            ? payload.cafes.filter((cafe) => cafe.city === city)
            : payload.cafes;

        setCafes(filteredCafes);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setListError(error instanceof Error ? error.message : "Failed to load cafes");
          setCafes([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    const timeoutId = setTimeout(loadCafes, 250);

    // cancel stale requests when inputs change quickly
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [city, normalizedQuery]);

  async function handleSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeReviewCafeId) {
      return;
    }

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
          userEmail: reviewFormState.userEmail,
          userName: reviewFormState.userName,
          cafeId: activeReviewCafeId,
          tasteRating: Number(reviewFormState.tasteRating),
          aestheticRating: Number(reviewFormState.aestheticRating),
          studyRating: Number(reviewFormState.studyRating),
          priceEstimate: reviewFormState.priceEstimate
            ? Number(reviewFormState.priceEstimate)
            : null,
          textComment: reviewFormState.textComment || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to save review");
      }

      setReviewSuccess("Review saved.");
      setReviewFormState(initialReviewFormState);
      setActiveReviewCafeId(null);

      // reload cafes so averages update immediately
      const refreshEndpoint = normalizedQuery
        ? `/api/cafes/search?q=${encodeURIComponent(normalizedQuery)}`
        : city === "All"
          ? "/api/cafes"
          : `/api/cafes?city=${encodeURIComponent(city)}`;

      const refreshedResponse = await fetch(refreshEndpoint, {
        method: "GET",
        cache: "no-store",
      });

      if (!refreshedResponse.ok) {
        throw new Error("Failed to refresh cafes");
      }

      const refreshedPayload = (await refreshedResponse.json()) as { cafes: Cafe[] };
      const filteredCafes =
        normalizedQuery && city !== "All"
          ? refreshedPayload.cafes.filter((cafe) => cafe.city === city)
          : refreshedPayload.cafes;

      setCafes(filteredCafes);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Failed to save review");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">MatchaDex Cafes</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Browse cafes by city, search names, and track average ratings.
        </p>
      </section>

      <section className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-zinc-700">
          City
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
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
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="matcha"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
          />
        </label>
      </section>

      {isLoading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Loading cafes...
        </div>
      ) : null}

      {listError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {listError}
        </div>
      ) : null}

      {!isLoading && !listError && cafes.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No cafes found for this filter.
        </div>
      ) : null}

      <section className="grid gap-4">
        {cafes.map((cafe) => (
          <article key={cafe.id} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{cafe.name}</h2>
                <p className="mt-1 text-sm text-zinc-600">{cafe.address ?? "Address unavailable"}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{cafe.city}</p>
              </div>

              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
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
              <button
                type="button"
                onClick={() => {
                  setActiveReviewCafeId((current) =>
                    current === cafe.id ? null : cafe.id,
                  );
                  setReviewError(null);
                  setReviewSuccess(null);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {activeReviewCafeId === cafe.id ? "Close review form" : "Write / Edit review"}
              </button>
            </div>

            {activeReviewCafeId === cafe.id ? (
              <form onSubmit={handleSubmitReview} className="mt-4 grid gap-3 rounded-lg border border-zinc-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={reviewFormState.userEmail}
                    onChange={(event) =>
                      setReviewFormState((current) => ({
                        ...current,
                        userEmail: event.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
                    required
                  />

                  <input
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
                  disabled={isSubmittingReview}
                  className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {isSubmittingReview ? "Saving..." : "Save review"}
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>

      {reviewSuccess ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {reviewSuccess}
        </div>
      ) : null}
    </main>
  );
}
