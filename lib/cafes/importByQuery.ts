import type { PrismaClient } from "@prisma/client";
import {
  BANNED_CAFE_WORDS,
  getMatchingBannedWord,
  inferCityLabelFromText,
  isCafeOrCoffeeType,
} from "@/scripts/importCafes.helpers";

type TextSearchResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  types?: string[];
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type TextSearchResponse = {
  status?: string;
  error_message?: string;
  next_page_token?: string;
  results?: TextSearchResult[];
};

type ImportCafeByQueryOptions = {
  prisma: PrismaClient;
  googlePlacesApiKey: string;
  query: string;
  cityOverride?: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isExplicitQueryForCafe(query: string, cafeName: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(cafeName);
  return normalizedQuery.includes(normalizedName) || normalizedName.includes(normalizedQuery);
}

export async function fetchTextSearchPage(
  googlePlacesApiKey: string,
  query: string,
  pageToken?: string,
) {
  const params = new URLSearchParams({
    query,
    key: googlePlacesApiKey,
  });

  if (pageToken) {
    params.set("pagetoken", pageToken);
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`,
    { method: "GET", cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Google Places text search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as TextSearchResponse;

  if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    throw new Error(payload.error_message ?? `Google Places text search returned ${payload.status}`);
  }

  return payload;
}

function toCafeRecord(place: TextSearchResult) {
  const googlePlaceId = place.place_id?.trim();
  const name = place.name?.trim();
  const address = place.formatted_address?.trim() ?? null;
  const latitude = place.geometry?.location?.lat ?? null;
  const longitude = place.geometry?.location?.lng ?? null;
  const types = place.types ?? [];

  if (!googlePlaceId || !name || latitude === null || longitude === null) {
    return null;
  }

  return {
    googlePlaceId,
    name,
    address,
    latitude,
    longitude,
    types,
  };
}

export async function importCafeByQuery({
  prisma,
  googlePlacesApiKey,
  query,
  cityOverride,
}: ImportCafeByQueryOptions) {
  const payload = await fetchTextSearchPage(googlePlacesApiKey, query);
  const results = payload.results ?? [];

  for (const result of results) {
    const cafe = toCafeRecord(result);
    if (!cafe) {
      continue;
    }

    const isExplicitlyListed = isExplicitQueryForCafe(query, cafe.name);
    const bannedWord = getMatchingBannedWord(cafe.name, cafe.address, BANNED_CAFE_WORDS);
    if (bannedWord && !isExplicitlyListed) {
      continue;
    }

    if (!isCafeOrCoffeeType(cafe.types)) {
      continue;
    }

    const city = cityOverride ?? inferCityLabelFromText(query, cafe.address);
    if (!city) {
      continue;
    }

    await prisma.cafe.upsert({
      where: { googlePlaceId: cafe.googlePlaceId },
      update: {
        name: cafe.name,
        address: cafe.address,
        city,
        latitude: cafe.latitude,
        longitude: cafe.longitude,
      },
      create: {
        googlePlaceId: cafe.googlePlaceId,
        name: cafe.name,
        address: cafe.address,
        city,
        latitude: cafe.latitude,
        longitude: cafe.longitude,
      },
    });

    return {
      imported: true,
      cafeName: cafe.name,
      googlePlaceId: cafe.googlePlaceId,
    };
  }

  return {
    imported: false,
  };
}
