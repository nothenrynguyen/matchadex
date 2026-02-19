"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Toast from "@/app/components/toast";

type SortOption = "rating_desc" | "rating_asc" | "name_asc" | "name_desc";

type Cafe = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  googlePlaceId: string;
  latitude: number | null;
  longitude: number | null;
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

type MapboxMap = {
  flyTo: (options: { center: [number, number]; zoom?: number; essential?: boolean }) => void;
  fitBounds: (bounds: { extend: (point: [number, number]) => unknown }, options?: { padding?: number }) => void;
  on: (eventName: string, callback: () => void) => void;
  remove: () => void;
};

type MapboxMarker = {
  addTo: (map: MapboxMap) => MapboxMarker;
  setLngLat: (lngLat: [number, number]) => MapboxMarker;
  remove: () => void;
};

type MapboxInstance = {
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (options: { element: HTMLElement }) => MapboxMarker;
  LngLatBounds: new () => { extend: (point: [number, number]) => unknown };
  accessToken: string;
};

type MarkerState = {
  marker: MapboxMarker;
  element: HTMLButtonElement;
};

declare global {
  interface Window {
    mapboxgl?: MapboxInstance;
  }
}

const cityOptions = ["All", "LA", "OC", "Bay Area", "Seattle", "NYC"];

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "rating_desc", label: "Rating: High to low" },
  { value: "rating_asc", label: "Rating: Low to high" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

function ratingText(value: number | null) {
  return value === null ? "N/A" : value.toFixed(1);
}

function setMarkerActiveStyle(markerElement: HTMLButtonElement, isActive: boolean) {
  markerElement.style.width = isActive ? "16px" : "12px";
  markerElement.style.height = isActive ? "16px" : "12px";
  markerElement.style.borderRadius = "9999px";
  markerElement.style.border = isActive ? "2px solid #14532d" : "2px solid #166534";
  markerElement.style.backgroundColor = isActive ? "#22c55e" : "#10b981";
  markerElement.style.boxShadow = isActive
    ? "0 0 0 6px rgba(34, 197, 94, 0.22)"
    : "0 0 0 2px rgba(16, 185, 129, 0.18)";
  markerElement.style.cursor = "pointer";
}

async function loadMapboxAssets() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.mapboxgl) {
    return window.mapboxgl;
  }

  const mapboxCssId = "matchadex-mapbox-css";
  const mapboxScriptId = "matchadex-mapbox-script";

  if (!document.getElementById(mapboxCssId)) {
    const cssLink = document.createElement("link");
    cssLink.id = mapboxCssId;
    cssLink.rel = "stylesheet";
    cssLink.href = "https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.css";
    document.head.appendChild(cssLink);
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(mapboxScriptId) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.mapboxgl) {
        resolve();
      } else {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Mapbox script failed to load")), {
          once: true,
        });
      }

      return;
    }

    const script = document.createElement("script");
    script.id = mapboxScriptId;
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mapbox script failed to load"));
    document.body.appendChild(script);
  });

  return window.mapboxgl ?? null;
}

function CafesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, MarkerState>>(new Map());

  const [city, setCity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("rating_desc");
  const [page, setPage] = useState(1);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [pagination, setPagination] = useState<PaginatedCafeResponse["pagination"]>({
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const normalizedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);
  const metroFromQuery = searchParams.get("metro");
  const mapboxPublicToken = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;

  const cafesWithCoordinates = useMemo(
    () => cafes.filter((cafe) => cafe.latitude !== null && cafe.longitude !== null),
    [cafes],
  );

  useEffect(() => {
    if (!metroFromQuery) {
      return;
    }

    if (cityOptions.includes(metroFromQuery) && metroFromQuery !== city) {
      setCity(metroFromQuery);
    }
  }, [city, metroFromQuery]);

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
          user: { email: string | null } | null;
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

        const params = new URLSearchParams({
          page: String(page),
          pageSize: "12",
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

    loadCafes();

    return () => {
      controller.abort();
    };
  }, [city, normalizedQuery, sort, page]);

  useEffect(() => {
    if (cafes.length === 0) {
      setSelectedCafeId(null);
      return;
    }

    if (!selectedCafeId || !cafes.some((cafe) => cafe.id === selectedCafeId)) {
      setSelectedCafeId(cafes[0].id);
    }
  }, [cafes, selectedCafeId]);

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
    let isCancelled = false;

    async function initializeMap() {
      if (!mapContainerRef.current) {
        return;
      }

      if (!mapboxPublicToken) {
        setMapError("Missing MAPBOX_PUBLIC_TOKEN.");
        setIsMapLoading(false);
        return;
      }

      try {
        setIsMapLoading(true);
        setMapError(null);

        const mapbox = await loadMapboxAssets();

        if (!mapbox || isCancelled) {
          return;
        }

        if (!mapRef.current) {
          mapbox.accessToken = mapboxPublicToken;
          mapRef.current = new mapbox.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox/light-v11",
            center: [-118.2437, 34.0522],
            zoom: 9,
          });

          mapRef.current.on("load", () => {
            if (!isCancelled) {
              setIsMapLoading(false);
            }
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setMapError(error instanceof Error ? error.message : "Failed to load map");
          setIsMapLoading(false);
        }
      }
    }

    initializeMap();

    return () => {
      isCancelled = true;
    };
  }, [mapboxPublicToken]);

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = window.mapboxgl;

    if (!map || !mapbox) {
      return;
    }

    markersRef.current.forEach((markerState) => {
      markerState.marker.remove();
    });
    markersRef.current.clear();

    cafesWithCoordinates.forEach((cafe) => {
      if (cafe.latitude === null || cafe.longitude === null) {
        return;
      }

      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.title = cafe.name;
      setMarkerActiveStyle(markerElement, cafe.id === selectedCafeId);

      markerElement.addEventListener("click", () => {
        setSelectedCafeId(cafe.id);
      });

      const marker = new mapbox.Marker({ element: markerElement })
        .setLngLat([cafe.longitude, cafe.latitude])
        .addTo(map);

      markersRef.current.set(cafe.id, {
        marker,
        element: markerElement,
      });
    });

    if (cafesWithCoordinates.length > 0) {
      const bounds = new mapbox.LngLatBounds();

      cafesWithCoordinates.forEach((cafe) => {
        if (cafe.latitude !== null && cafe.longitude !== null) {
          bounds.extend([cafe.longitude, cafe.latitude]);
        }
      });

      map.fitBounds(bounds, { padding: 60 });
    }

    if (!isMapLoading) {
      setMapError(cafesWithCoordinates.length === 0 ? "No mapped cafes for this metro." : null);
    }
  }, [cafesWithCoordinates, isMapLoading, selectedCafeId]);

  useEffect(() => {
    markersRef.current.forEach((markerState, cafeId) => {
      setMarkerActiveStyle(markerState.element, cafeId === selectedCafeId);
    });
  }, [selectedCafeId]);

  useEffect(() => {
    const markerMap = markersRef.current;

    return () => {
      markerMap.forEach((markerState) => markerState.marker.remove());
      markerMap.clear();

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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

  function handleCafeClick(cafe: Cafe) {
    setSelectedCafeId(cafe.id);

    if (cafe.latitude !== null && cafe.longitude !== null && mapRef.current) {
      mapRef.current.flyTo({
        center: [cafe.longitude, cafe.latitude],
        zoom: 13,
        essential: true,
      });
    }
  }

  return (
    <main className="mx-auto h-[calc(100vh-9.5rem)] max-w-[1500px] overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <section className="grid h-full grid-cols-1 gap-4 lg:grid-cols-10">
        <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-[#fffdf6] lg:col-span-3">
          <div className="border-b border-emerald-100 bg-[#f3f1e7] p-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-semibold text-zinc-900">MatchaDex Cafes</h1>
              <Link
                href="/cafes/leaderboard"
                className="rounded-md border border-emerald-200 bg-[#eef4eb] px-2.5 py-1.5 text-xs text-emerald-900 hover:bg-[#e3ecdf]"
              >
                Leaderboard
              </Link>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                aria-label="Search cafe name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search cafe name"
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
              />

              <select
                aria-label="Filter cafes by metro"
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
            </div>
          </div>

          <div className="border-b border-emerald-100 px-4 py-2 text-xs text-zinc-600">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} cafes)
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`skeleton-${index + 1}`} className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="h-4 w-40 rounded bg-zinc-200" />
                    <div className="mt-2 h-3 w-56 rounded bg-zinc-100" />
                    <div className="mt-3 h-3 w-24 rounded bg-zinc-100" />
                  </div>
                ))}
              </div>
            ) : null}

            {!isLoading && listError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {listError}
              </div>
            ) : null}

            {!isLoading && !listError && cafes.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                No cafes found for this metro or search query.
              </div>
            ) : null}

            {!isLoading && !listError && cafes.length > 0 ? (
              <div className="grid gap-3">
                {cafes.map((cafe) => {
                  const isSelected = cafe.id === selectedCafeId;

                  return (
                    <article
                      key={cafe.id}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-zinc-200 bg-white hover:border-emerald-200"
                      }`}
                      onClick={() => handleCafeClick(cafe)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-semibold text-zinc-900">{cafe.name}</h2>
                          <p className="mt-1 text-xs text-zinc-600">{cafe.address ?? "Address unavailable"}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">{cafe.city}</p>
                        </div>
                        <div className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                          {ratingText(cafe.averageRatings.overallRating)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/cafes/${cafe.id}`}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                          onClick={(event) => event.stopPropagation()}
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(cafe.id, !cafe.isFavorited);
                          }}
                          className={`rounded-md border px-2 py-1 text-xs ${
                            cafe.isFavorited
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {cafe.isFavorited ? "Favorited" : "Add favorite"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-emerald-100 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={!pagination.hasPreviousPage || isLoading}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={!pagination.hasNextPage || isLoading}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </aside>

        <section className="relative h-full overflow-hidden rounded-2xl border border-emerald-100 bg-white lg:col-span-7">
          <div ref={mapContainerRef} className="h-full w-full" />

          {isMapLoading ? (
            <div className="absolute inset-0 grid place-items-center bg-[#f8f6ee]/95">
              <div className="w-full max-w-sm animate-pulse rounded-xl border border-zinc-200 bg-white p-4">
                <div className="h-4 w-40 rounded bg-zinc-200" />
                <div className="mt-2 h-3 w-full rounded bg-zinc-100" />
                <div className="mt-2 h-3 w-4/5 rounded bg-zinc-100" />
              </div>
            </div>
          ) : null}

          {mapError ? (
            <div className="absolute left-3 top-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {mapError}
            </div>
          ) : null}
        </section>
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

export default function CafesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto h-[calc(100vh-9.5rem)] max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-full animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </main>
      }
    >
      <CafesPageContent />
    </Suspense>
  );
}
