"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Toast from "@/app/components/toast";

type UserProfilePayload = {
  user: {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    reviews: Array<{
      id: string;
      cafeId: string;
      tasteRating: number;
      aestheticRating: number;
      studyRating: number;
      priceEstimate: number | null;
      textComment: string | null;
      updatedAt: string;
      cafe: {
        id: string;
        name: string;
        city: string;
      };
    }>;
    favorites: Array<{
      id: string;
      createdAt: string;
      cafe: {
        id: string;
        name: string;
        city: string;
        address: string | null;
      };
    }>;
  };
  canManageReviews: boolean;
};

type ReviewFormState = {
  tasteRating: string;
  aestheticRating: string;
  studyRating: string;
  priceEstimate: string;
  textComment: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [profilePayload, setProfilePayload] = useState<UserProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewFormState, setReviewFormState] = useState<ReviewFormState>({
    tasteRating: "5",
    aestheticRating: "5",
    studyRating: "5",
    priceEstimate: "",
    textComment: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastState, setToastState] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [profileReloadCount, setProfileReloadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();

    async function loadProfile() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Failed to load profile");
        }

        const payload = (await response.json()) as UserProfilePayload;
        setProfilePayload(payload);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load profile");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      controller.abort();
    };
  }, [userId, profileReloadCount]);

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

  function startEditingReview(review: UserProfilePayload["user"]["reviews"][number]) {
    setEditingReviewId(review.id);
    setReviewFormState({
      tasteRating: String(review.tasteRating),
      aestheticRating: String(review.aestheticRating),
      studyRating: String(review.studyRating),
      priceEstimate: review.priceEstimate === null ? "" : String(review.priceEstimate),
      textComment: review.textComment ?? "",
    });
  }

  async function refreshProfile() {
    if (!userId) {
      return;
    }

    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to refresh profile");
    }

    const payload = (await response.json()) as UserProfilePayload;
    setProfilePayload(payload);
  }

  async function handleSaveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profilePayload || !editingReviewId) {
      return;
    }

    const editingReview = profilePayload.user.reviews.find((review) => review.id === editingReviewId);

    if (!editingReview) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cafeId: editingReview.cafeId,
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

      await refreshProfile();
      setEditingReviewId(null);
      setToastState({ message: "Review updated.", tone: "success" });
    } catch (error) {
      setToastState({
        message: error instanceof Error ? error.message : "Failed to save review.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!profilePayload) {
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to delete review");
      }

      await refreshProfile();
      setEditingReviewId((currentReviewId) => (currentReviewId === reviewId ? null : currentReviewId));
      setToastState({ message: "Review deleted.", tone: "success" });
    } catch (error) {
      setToastState({
        message: error instanceof Error ? error.message : "Failed to delete review.",
        tone: "error",
      });
    }
  }

  async function handleToggleFavorite(cafeId: string, isFavorited: boolean) {
    try {
      const response = await fetch(`/api/cafes/${encodeURIComponent(cafeId)}/favorite`, {
        method: isFavorited ? "DELETE" : "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to update favorite");
      }

      await refreshProfile();
      setToastState({
        message: isFavorited ? "Favorite removed." : "Favorite added.",
        tone: "success",
      });
    } catch (error) {
      setToastState({
        message: error instanceof Error ? error.message : "Failed to update favorite.",
        tone: "error",
      });
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6">
          <div className="h-7 w-56 rounded bg-zinc-200" />
          <div className="mt-3 h-4 w-80 rounded bg-zinc-100" />
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
        <button
          type="button"
          onClick={() => setProfileReloadCount((currentCount) => currentCount + 1)}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!profilePayload) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          User not found.
        </div>
      </main>
    );
  }

  const { user, canManageReviews } = profilePayload;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {(user.name || user.email).toLowerCase()}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
          Joined {formatDate(user.createdAt)}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900">Favorite cafes</h2>

        {user.favorites.length === 0 ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            No favorites yet.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {user.favorites.map((favorite) => (
              <article key={favorite.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <Link href={`/cafes/${favorite.cafe.id}`} className="text-sm font-semibold text-zinc-900 hover:underline">
                  {favorite.cafe.name}
                </Link>
                <p className="mt-1 text-sm text-zinc-600">{favorite.cafe.address || "Address unavailable"}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{favorite.cafe.city}</p>
                {canManageReviews ? (
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(favorite.cafe.id, true)}
                    className="mt-3 rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    Remove favorite
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900">Reviews</h2>

        {user.reviews.length === 0 ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            No reviews yet.
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {user.reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link href={`/cafes/${review.cafe.id}`} className="text-sm font-semibold text-zinc-900 hover:underline">
                      {review.cafe.name}
                    </Link>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">{review.cafe.city}</p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {formatDate(review.updatedAt)}</p>
                  </div>

                  {canManageReviews ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingReview(review)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(review.id)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 grid gap-1 text-sm text-zinc-600 sm:grid-cols-3">
                  <p>Taste: {review.tasteRating}</p>
                  <p>Aesthetic: {review.aestheticRating}</p>
                  <p>Study: {review.studyRating}</p>
                </div>

                {review.textComment ? (
                  <p className="mt-2 text-sm text-zinc-700">{review.textComment}</p>
                ) : null}

                {editingReviewId === review.id ? (
                  <form onSubmit={handleSaveReview} className="mt-4 grid gap-3 rounded-lg border border-zinc-200 p-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <input
                        value={reviewFormState.tasteRating}
                        onChange={(event) =>
                          setReviewFormState((currentState) => ({
                            ...currentState,
                            tasteRating: event.target.value,
                          }))
                        }
                        type="number"
                        min={1}
                        max={5}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        value={reviewFormState.aestheticRating}
                        onChange={(event) =>
                          setReviewFormState((currentState) => ({
                            ...currentState,
                            aestheticRating: event.target.value,
                          }))
                        }
                        type="number"
                        min={1}
                        max={5}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        value={reviewFormState.studyRating}
                        onChange={(event) =>
                          setReviewFormState((currentState) => ({
                            ...currentState,
                            studyRating: event.target.value,
                          }))
                        }
                        type="number"
                        min={1}
                        max={5}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        value={reviewFormState.priceEstimate}
                        onChange={(event) =>
                          setReviewFormState((currentState) => ({
                            ...currentState,
                            priceEstimate: event.target.value,
                          }))
                        }
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Price"
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <textarea
                      value={reviewFormState.textComment}
                      onChange={(event) =>
                        setReviewFormState((currentState) => ({
                          ...currentState,
                          textComment: event.target.value,
                        }))
                      }
                      maxLength={500}
                      className="min-h-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      placeholder="Comment"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {isSubmitting ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingReviewId(null)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

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
