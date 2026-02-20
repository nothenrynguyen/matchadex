"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Toast from "@/app/components/toast";
import { formatRatingLabel } from "./rating";

type SortOption = "rating" | "popularity";

type Cafe = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  googlePlaceId: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  averageRating: number | null;
  reviewCount: number;
  weightedRating: number | null;
  isFavorited: boolean;
};

type CafePreview = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  isFavorited: boolean;
  averageRatings: {
    reviewCount: number;
    overallRating: number | null;
  };
  reviews: Array<{
    id: string;
    tasteRating: number;
    aestheticRating: number;
    studyRating: number;
    textComment: string | null;
    createdAt: string;
    user: {
      name: string | null;
      email: string;
    };
  }>;
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

type MapboxPopup = {
  setLngLat: (lngLat: [number, number]) => MapboxPopup;
  setHTML: (html: string) => MapboxPopup;
  addTo: (map: MapboxMap) => MapboxPopup;
  remove: () => void;
};

type MapboxInstance = {
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (options: { element: HTMLElement }) => MapboxMarker;
  Popup: new (options?: { closeButton?: boolean; closeOnClick?: boolean; offset?: number }) => MapboxPopup;
  LngLatBounds: new () => { extend: (point: [number, number]) => unknown };
  accessToken: string;
};

type MarkerState = {
  marker: MapboxMarker;
  element: HTMLButtonElement;
  popup: MapboxPopup;
};

declare global {
  interface Window {
    mapboxgl?: MapboxInstance;
  }
}

const cityFilterOptions = [
  { label: "LA", value: "LA" },
  { label: "OC", value: "OC" },
  { label: "Bay", value: "Bay" },
  { label: "NYC", value: "NYC" },
  { label: "Seattle", value: "Seattle" },
];

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "rating", label: "Weighted rating" },
  { value: "popularity", label: "Popularity" },
];

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
  const cafeItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const selectedCafeIdRef = useRef<string | null>(null);
  const markersRef = useRef<Map<string, MarkerState>>(new Map());

  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("rating");
  const [page, setPage] = useState(1);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [listReloadCount, setListReloadCount] = useState(0);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [previewCafe, setPreviewCafe] = useState<CafePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
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
  const mapboxPublicToken =
    process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const cafesWithCoordinates = useMemo(
    () => cafes.filter((cafe) => cafe.latitude !== null && cafe.longitude !== null),
    [cafes],
  );
  const allCityValues = useMemo(() => cityFilterOptions.map((option) => option.value), []);
  const selectedCafe = useMemo(
    () => cafes.find((cafe) => cafe.id === selectedCafeId) ?? null,
    [cafes, selectedCafeId],
  );

  useEffect(() => {
    const tokenLength = mapboxPublicToken?.length ?? 0;
    // Runtime observability only; do not print token value.
    console.info(`[cafes-map] mapbox token present=${tokenLength > 0} length=${tokenLength}`);
  }, [mapboxPublicToken]);

  useEffect(() => {
    if (!metroFromQuery) {
      return;
    }

    if (metroFromQuery === "All") {
      setSelectedCities([]);
      return;
    }

    const mappedValue = metroFromQuery === "Bay Area" ? "Bay" : metroFromQuery;
    if (allCityValues.includes(mappedValue)) {
      setSelectedCities([mappedValue]);
    }
  }, [allCityValues, metroFromQuery]);

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
  }, [selectedCities, normalizedQuery, sort]);

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

        for (const city of selectedCities) {
          params.append("city", city);
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
  }, [selectedCities, normalizedQuery, sort, page, listReloadCount]);

  useEffect(() => {
    if (!selectedCafeId) {
      setPreviewCafe(null);
      return;
    }
    const currentSelectedCafeId: string = selectedCafeId;

    const controller = new AbortController();

    async function loadPreviewCafe() {
      try {
        setIsPreviewLoading(true);
        const response = await fetch(`/api/cafes/${encodeURIComponent(currentSelectedCafeId)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load cafe preview");
        }

        const payload = (await response.json()) as { cafe: CafePreview };
        setPreviewCafe(payload.cafe);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPreviewCafe(null);
        }
      } finally {
        setIsPreviewLoading(false);
      }
    }

    loadPreviewCafe();

    return () => {
      controller.abort();
    };
  }, [selectedCafeId]);

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
        setMapError("Map failed to load: missing Mapbox token.");
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

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
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
          setMapError(`Map failed to load: ${error instanceof Error ? error.message : "unknown error"}`);
          setIsMapLoading(false);
        }
      }
    }

    initializeMap();

    return () => {
      isCancelled = true;
    };
  }, [mapboxPublicToken, mapRetryKey]);

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = window.mapboxgl;

    if (!map || !mapbox) {
      return;
    }

    markersRef.current.forEach((markerState) => {
      markerState.marker.remove();
      markerState.popup.remove();
    });
    markersRef.current.clear();

    cafesWithCoordinates.forEach((cafe) => {
      if (cafe.latitude === null || cafe.longitude === null) {
        return;
      }
      const cafeLatitude = cafe.latitude;
      const cafeLongitude = cafe.longitude;

      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.title = cafe.name;
      setMarkerActiveStyle(markerElement, cafe.id === selectedCafeIdRef.current);

      markerElement.addEventListener("click", () => {
        setSelectedCafeId(cafe.id);

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [cafeLongitude, cafeLatitude],
            zoom: 13,
            essential: true,
          });
        }
      });

      const popup = new mapbox.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
      }).setHTML(
        `<div style="font-size:12px;font-weight:600;color:#20302a;padding:2px 4px;">${cafe.name}</div>`,
      );

      markerElement.addEventListener("mouseenter", () => {
        popup.setLngLat([cafeLongitude, cafeLatitude]).addTo(map);
      });

      markerElement.addEventListener("mouseleave", () => {
        popup.remove();
      });

      const marker = new mapbox.Marker({ element: markerElement })
        .setLngLat([cafeLongitude, cafeLatitude])
        .addTo(map);

      markersRef.current.set(cafe.id, {
        marker,
        element: markerElement,
        popup,
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
      setMapError(cafesWithCoordinates.length === 0 ? "No mapped cafes for selected filters." : null);
    }
  }, [cafesWithCoordinates, isMapLoading]);

  useEffect(() => {
    selectedCafeIdRef.current = selectedCafeId;
    markersRef.current.forEach((markerState, cafeId) => {
      setMarkerActiveStyle(markerState.element, cafeId === selectedCafeId);
    });
  }, [selectedCafeId]);

  useEffect(() => {
    if (!selectedCafeId) {
      return;
    }

    const selectedCafeElement = cafeItemRefs.current.get(selectedCafeId);

    if (selectedCafeElement) {
      selectedCafeElement.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedCafeId]);

  useEffect(() => {
    const markerMap = markersRef.current;

    return () => {
      markerMap.forEach((markerState) => {
        markerState.marker.remove();
        markerState.popup.remove();
      });
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
      setPreviewCafe((currentCafe) =>
        currentCafe && currentCafe.id === cafeId
          ? {
              ...currentCafe,
              isFavorited: nextIsFavorited,
            }
          : currentCafe,
      );
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

  function handleCityFilterToggle(cityValue: string) {
    setSelectedCities((currentCities) => {
      if (currentCities.includes(cityValue)) {
        return currentCities.filter((currentCity) => currentCity !== cityValue);
      }

      const nextCities = [...currentCities, cityValue];
      if (nextCities.length === allCityValues.length) {
        return [];
      }

      return nextCities;
    });
  }

  return (
    <main className="h-full min-h-0 flex flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <section className="flex-1 flex min-h-0 flex-col gap-4 lg:flex-row">
        <aside className="w-full overflow-hidden rounded-2xl border border-emerald-100 bg-[#fffdf6] lg:w-[400px] flex flex-col">
          <div className="border-b border-emerald-100 bg-[#f3f1e7] p-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-semibold text-zinc-900">MatchaDex Cafes</h1>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                aria-label="Search cafe name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search cafe name"
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-100 focus:ring"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCities([])}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    selectedCities.length === 0
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  All
                </button>
                {cityFilterOptions.map((option) => {
                  const isSelected = selectedCities.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleCityFilterToggle(option.value)}
                      className={`rounded-md border px-3 py-1.5 text-xs ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

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

          <div className="w-full overflow-y-auto p-3 flex-1">
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
                <p>{listError}</p>
                <button
                  type="button"
                  onClick={() => setListReloadCount((currentCount) => currentCount + 1)}
                  className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!isLoading && !listError && cafes.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                No cafes found for selected filters or search query.
              </div>
            ) : null}

            {!isLoading && !listError && cafes.length > 0 ? (
              <div className="grid gap-3">
                {cafes.map((cafe) => {
                  const isSelected = cafe.id === selectedCafeId;

                  return (
                    <article
                      key={cafe.id}
                      ref={(element) => {
                        if (element) {
                          cafeItemRefs.current.set(cafe.id, element);
                        } else {
                          cafeItemRefs.current.delete(cafe.id);
                        }
                      }}
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
                          {`${formatRatingLabel(cafe.weightedRating)} (${cafe.reviewCount} reviews)`}
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

        <section className="relative flex-1 h-full overflow-hidden rounded-2xl border border-emerald-100 bg-white">
          <div ref={mapContainerRef} className="h-full min-h-[360px] w-full" />

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
            <div
              className={`absolute left-3 top-3 rounded-lg px-3 py-2 text-xs ${
                mapError === "No mapped cafes for selected filters."
                  ? "border border-zinc-200 bg-white text-zinc-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <p>{mapError}</p>
              {mapError !== "No mapped cafes for selected filters." ? (
                <button
                  type="button"
                  onClick={() => setMapRetryKey((currentKey) => currentKey + 1)}
                  className="mt-2 rounded-md border border-red-300 bg-white px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {selectedCafeId ? (
            <div className="absolute inset-0 z-20 flex items-end justify-center bg-zinc-950/30 p-3 sm:items-center sm:justify-end sm:p-4">
              <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {previewCafe?.name ?? selectedCafe?.name ?? "Cafe"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {previewCafe?.address ?? selectedCafe?.address ?? "Address unavailable"}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
                      {previewCafe?.city ?? selectedCafe?.city ?? ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCafeId(null)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
                  {isPreviewLoading
                    ? "Loading preview..."
                    : `${formatRatingLabel(previewCafe?.averageRatings.overallRating ?? selectedCafe?.weightedRating ?? null)} (${previewCafe?.averageRatings.reviewCount ?? selectedCafe?.reviewCount ?? 0} reviews)`}
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recent reviews</p>
                  {isPreviewLoading ? (
                    <p className="text-xs text-zinc-500">Loading reviews...</p>
                  ) : previewCafe && previewCafe.reviews.length > 0 ? (
                    previewCafe.reviews.slice(0, 3).map((review) => (
                      <article key={review.id} className="rounded-md border border-zinc-200 p-2">
                        <p className="text-xs font-medium text-zinc-800">
                          {(review.user.name || review.user.email).toLowerCase()}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          T {review.tasteRating} · A {review.aestheticRating} · S {review.studyRating}
                        </p>
                        {review.textComment ? (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-700">{review.textComment}</p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500">No reviews yet.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCafe) {
                        handleToggleFavorite(selectedCafe.id, !selectedCafe.isFavorited);
                      }
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      selectedCafe?.isFavorited
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {selectedCafe?.isFavorited ? "Favorited" : "Add favorite"}
                  </button>
                  <Link
                    href={`/cafes/${selectedCafeId}`}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    View full page
                  </Link>
                </div>
              </div>
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
        <main className="h-full min-h-0 flex flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-full animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </main>
      }
    >
      <CafesPageContent />
    </Suspense>
  );
}
