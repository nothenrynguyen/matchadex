"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Toast from "@/app/components/toast";

type CafeDetail = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  isFavorited: boolean;
  viewerPrismaUserId: string | null;
  averageRatings: {
    reviewCount: number;
    tasteRating: number | null;
    aestheticRating: number | null;
    studyRating: number | null;
    overallRating: number | null;
  };
  reviews: Array<{
    id: string;
    cafeId: string;
    tasteRating: number;
    aestheticRating: number;
    studyRating: number;
    priceEstimate: number | null;
    textComment: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
};

type ReviewFormState = {
  tasteRating: string;
  aestheticRating: string;
  studyRating: string;
  priceEstimate: string;
  textComment: string;
};

type CafePhoto = {
  name: string;
  path: string;
  publicUrl: string;
  createdAt: string;
};

function ratingText(value: number | null) {
  return value === null ? "N/A" : value.toFixed(1);
}

function DetailSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6">
        <div className="h-7 w-64 rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-80 rounded bg-zinc-100" />
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="h-14 rounded bg-zinc-100" />
          <div className="h-14 rounded bg-zinc-100" />
          <div className="h-14 rounded bg-zinc-100" />
          <div className="h-14 rounded bg-zinc-100" />
        </div>
      </div>
    </main>
  );
}

export default function CafeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const cafeId = params?.id;

  const [cafe, setCafe] = useState<CafeDetail | null>(null);
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
  const [photos, setPhotos] = useState<CafePhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const ownReviewIds = useMemo(() => {
    if (!cafe?.viewerPrismaUserId) {
      return new Set<string>();
    }

    return new Set(
      cafe.reviews
        .filter((review) => review.user.id === cafe.viewerPrismaUserId)
        .map((review) => review.id),
    );
  }, [cafe]);

  useEffect(() => {
    if (!cafeId) {
      return;
    }

    const controller = new AbortController();

    async function loadCafeDetail() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/cafes/${encodeURIComponent(cafeId)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Failed to load cafe detail");
        }

        const payload = (await response.json()) as { cafe: CafeDetail };
        setCafe(payload.cafe);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load cafe detail");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadCafeDetail();

    return () => {
      controller.abort();
    };
  }, [cafeId]);

  useEffect(() => {
    if (!cafeId) {
      return;
    }

    async function loadPhotos() {
      try {
        setIsLoadingPhotos(true);

        const response = await fetch(`/api/cafes/${encodeURIComponent(cafeId)}/photos`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load photos");
        }

        const payload = (await response.json()) as { photos: CafePhoto[] };
        setPhotos(payload.photos || []);
      } catch {
        setPhotos([]);
      } finally {
        setIsLoadingPhotos(false);
      }
    }

    loadPhotos();
  }, [cafeId]);

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

  async function refreshCafeDetail() {
    if (!cafeId) {
      return;
    }

    const response = await fetch(`/api/cafes/${encodeURIComponent(cafeId)}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to refresh cafe detail");
    }

    const payload = (await response.json()) as { cafe: CafeDetail };
    setCafe(payload.cafe);
  }

  function startEditingReview(review: CafeDetail["reviews"][number]) {
    setEditingReviewId(review.id);
    setReviewFormState({
      tasteRating: String(review.tasteRating),
      aestheticRating: String(review.aestheticRating),
      studyRating: String(review.studyRating),
      priceEstimate: review.priceEstimate === null ? "" : String(review.priceEstimate),
      textComment: review.textComment ?? "",
    });
  }

  async function handleSaveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingReviewId || !cafe) {
      return;
    }

    const review = cafe.reviews.find((item) => item.id === editingReviewId);

    if (!review) {
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
          cafeId: review.cafeId,
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
        throw new Error(payload?.error ?? "Failed to update review");
      }

      await refreshCafeDetail();
      setEditingReviewId(null);
      setToastState({ message: "Review updated.", tone: "success" });
    } catch (error) {
      setToastState({
        message: error instanceof Error ? error.message : "Failed to update review.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteReview(reviewId: string) {
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

      await refreshCafeDetail();
      setEditingReviewId((currentId) => (currentId === reviewId ? null : currentId));
      setToastState({ message: "Review deleted.", tone: "success" });
    } catch (error) {
      setToastState({
        message: error instanceof Error ? error.message : "Failed to delete review.",
        tone: "error",
      });
    }
  }

  async function handleToggleFavorite() {
    if (!cafe) {
      return;
    }

    if (!cafe.viewerPrismaUserId) {
      router.push("/auth");
      return;
    }

    const nextIsFavorited = !cafe.isFavorited;
    setCafe({ ...cafe, isFavorited: nextIsFavorited });

    try {
      const response = await fetch(`/api/cafes/${encodeURIComponent(cafe.id)}/favorite`, {
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
      setCafe({ ...cafe, isFavorited: !nextIsFavorited });
      setToastState({
        message: error instanceof Error ? error.message : "Failed to update favorite.",
        tone: "error",
      });
    }
  }

  async function handleUploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cafe) {
      return;
    }

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const selectedFile = formData.get("file");

    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      setToastState({ message: "Select an image first.", tone: "error" });
      return;
    }

    try {
      setIsUploadingPhoto(true);

      const response = await fetch(`/api/cafes/${encodeURIComponent(cafe.id)}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to upload photo");
      }

      const listResponse = await fetch(`/api/cafes/${encodeURIComponent(cafe.id)}/photos`, {
        method: "GET",
        cache: "no-store",
      });
      const listPayload = (await listResponse.json()) as { photos: CafePhoto[] };
      setPhotos(listPayload.photos || []);
      formElement.reset();
      setToastState({ message: "Photo uploaded.", tone: "success" });
    } catch (error) {
      setToastState({
        message: error instanceof Error ? error.message : "Failed to upload photo.",
        tone: "error",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (errorMessage) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {errorMessage}
        </div>
        <Link href="/cafes" className="mt-4 inline-block text-sm font-medium text-emerald-700">
          Back to cafes
        </Link>
      </main>
    );
  }

  if (!cafe) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
          Cafe not found.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/cafes" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
        Back to cafes
      </Link>

      <section className="mt-4 rounded-2xl border border-emerald-100 bg-[#fffdf6] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{cafe.name}</h1>
            <p className="mt-2 text-sm text-zinc-600">{cafe.address ?? "Address unavailable"}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{cafe.city}</p>
          </div>
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={cafe.isFavorited ? "Remove favorite" : "Add favorite"}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              cafe.isFavorited
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {cafe.isFavorited ? "Favorited" : "Add favorite"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-[#eef4eb] p-3 text-sm text-zinc-700">
            <p className="text-xs text-zinc-500">Overall</p>
            <p className="text-lg font-semibold">{ratingText(cafe.averageRatings.overallRating)}</p>
          </div>
          <div className="rounded-lg bg-[#eef4eb] p-3 text-sm text-zinc-700">
            <p className="text-xs text-zinc-500">Taste</p>
            <p className="text-lg font-semibold">{ratingText(cafe.averageRatings.tasteRating)}</p>
          </div>
          <div className="rounded-lg bg-[#eef4eb] p-3 text-sm text-zinc-700">
            <p className="text-xs text-zinc-500">Aesthetic</p>
            <p className="text-lg font-semibold">{ratingText(cafe.averageRatings.aestheticRating)}</p>
          </div>
          <div className="rounded-lg bg-[#eef4eb] p-3 text-sm text-zinc-700">
            <p className="text-xs text-zinc-500">Study</p>
            <p className="text-lg font-semibold">{ratingText(cafe.averageRatings.studyRating)}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-600">{cafe.averageRatings.reviewCount} total reviews</p>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-100 bg-[#fffdf6] p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Cafe photos</h2>
          {cafe.viewerPrismaUserId ? (
            <form onSubmit={handleUploadPhoto} className="flex flex-wrap items-center gap-2">
              <input
                name="file"
                type="file"
                accept="image/*"
                aria-label="Upload cafe photo"
                className="block text-xs text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2"
              />
              <button
                type="submit"
                disabled={isUploadingPhoto}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {isUploadingPhoto ? "Uploading..." : "Upload"}
              </button>
            </form>
          ) : null}
        </div>

        {isLoadingPhotos ? (
          <p className="mt-3 text-sm text-zinc-500">Loading photos...</p>
        ) : null}

        {!isLoadingPhotos && photos.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No photos uploaded yet.</p>
        ) : null}

        {photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <a
                key={photo.path}
                href={photo.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-lg border border-zinc-200"
              >
                <Image
                  src={photo.publicUrl}
                  alt={`${cafe.name} photo`}
                  width={480}
                  height={288}
                  className="h-36 w-full object-cover transition group-hover:scale-[1.02]"
                />
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900">Recent reviews</h2>

        {cafe.reviews.length === 0 ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            No reviews yet.
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {cafe.reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-emerald-100 bg-[#fffdf6] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      {review.user.name || review.user.email}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {ownReviewIds.has(review.id) ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingReview(review)}
                        aria-label="Edit your review"
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(review.id)}
                        aria-label="Delete your review"
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
                  <p className="mt-3 text-sm text-zinc-700">{review.textComment}</p>
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
