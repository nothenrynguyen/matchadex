import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import manualCafes from "./manualCafes.json";
import {
  findExistingCafeForManualImport,
  getMatchingBannedWord,
  isCafeOrCoffeeType,
} from "./importCafes.helpers";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for import script");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;

const citySearchTargets = [
  { label: "LA", latitude: 34.052235, longitude: -118.243683, radiusMeters: 10000 },
  { label: "OC", latitude: 33.836594, longitude: -117.914299, radiusMeters: 10000 },
  { label: "Seattle", latitude: 47.606209, longitude: -122.332069, radiusMeters: 10000 },
];

const googlePlacesKeyword = "matcha OR coffee shop OR cafe";
const bannedWords = ["7-eleven", "barnes", "target", "hotel", "gas", "market", "station"];
const maxCityImportCount = 100;

type NearbySearchResult = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  types?: string[];
};

type NearbySearchResponse = {
  results?: NearbySearchResult[];
  next_page_token?: string;
  status?: string;
  error_message?: string;
};

type ManualCafe = {
  googlePlaceId: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  address?: string | null;
};

const manualCafeList = manualCafes as ManualCafe[];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function isManuallyAllowedCafe(cafe: NearbySearchResult) {
  const placeId = cafe.place_id?.trim();
  const normalizedName = cafe.name ? normalizeText(cafe.name) : null;

  return manualCafeList.some((manualCafe) => {
    if (placeId && manualCafe.googlePlaceId === placeId) {
      return true;
    }

    return normalizedName !== null && normalizeText(manualCafe.name) === normalizedName;
  });
}

async function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchNearbyCafes(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  pageToken?: string,
) {
  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: String(radiusMeters),
    type: "cafe",
    keyword: googlePlacesKeyword,
    key: googlePlacesApiKey ?? "",
  });

  if (pageToken) {
    params.set("pagetoken", pageToken);
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Google Places request failed with status ${response.status}`);
  }

  return (await response.json()) as NearbySearchResponse;
}

async function importForCity(target: (typeof citySearchTargets)[number]) {
  let pageToken: string | undefined;
  let pagesFetched = 0;
  let importedCount = 0;
  let skippedCount = 0;
  let isLimitReached = false;

  do {
    if (pageToken) {
      // Google Places requires a short wait before next_page_token becomes valid.
      await wait(2200);
    }

    const payload = await fetchNearbyCafes(
      target.latitude,
      target.longitude,
      target.radiusMeters,
      pageToken,
    );

    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      throw new Error(payload.error_message ?? `Google Places returned ${payload.status}`);
    }

    const cafes = payload.results ?? [];

    for (const cafe of cafes) {
      const googlePlaceId = cafe.place_id;
      const name = cafe.name?.trim();
      const address = cafe.vicinity?.trim() ?? null;
      const latitude = cafe.geometry?.location?.lat ?? null;
      const longitude = cafe.geometry?.location?.lng ?? null;
      const placeTypes = cafe.types ?? [];
      const isManualCafe = isManuallyAllowedCafe(cafe);

      if (!googlePlaceId || !name || latitude === null || longitude === null) {
        skippedCount += 1;
        console.log(
          `[import-cafes] skipped (${target.label}): missing required fields place_id=${googlePlaceId ?? "unknown"} name=${name ?? "unknown"}`,
        );
        continue;
      }

      // Keep obvious non-cafes out by requiring cafe/coffee place types and
      // rejecting convenience/generic-location keywords unless manually allowed.
      if (!isCafeOrCoffeeType(placeTypes) && !isManualCafe) {
        skippedCount += 1;
        console.log(
          `[import-cafes] skipped (${target.label}): "${name}" missing cafe/coffee place type`,
        );
        continue;
      }

      const bannedWord = getMatchingBannedWord(name, address, bannedWords);
      if (bannedWord && !isManualCafe) {
        skippedCount += 1;
        console.log(
          `[import-cafes] skipped (${target.label}): "${name}" matched banned word "${bannedWord}"`,
        );
        continue;
      }

      await prisma.cafe.upsert({
        where: { googlePlaceId },
        update: {
          name,
          address,
          city: target.label,
          latitude,
          longitude,
        },
        create: {
          name,
          address,
          city: target.label,
          googlePlaceId,
          latitude,
          longitude,
        },
      });

      importedCount += 1;

      if (importedCount >= maxCityImportCount) {
        isLimitReached = true;
        break;
      }
    }

    if (isLimitReached) {
      break;
    }

    pageToken = payload.next_page_token;
    pagesFetched += 1;
  } while (pageToken && pagesFetched < 3);

  return { importedCount, skippedCount, isLimitReached };
}

async function importManualCafes() {
  let importedCount = 0;

  for (const manualCafe of manualCafeList) {
    const googlePlaceId = manualCafe.googlePlaceId.trim();
    const name = manualCafe.name.trim();
    const city = manualCafe.city.trim();
    const address = manualCafe.address?.trim() || null;

    if (!googlePlaceId || !name || !city) {
      console.log(
        `[import-cafes] skipped manual cafe: missing required fields place_id=${googlePlaceId || "unknown"} name=${name || "unknown"}`,
      );
      continue;
    }

    const existingCafes = await prisma.cafe.findMany({
      where: {
        OR: [
          { googlePlaceId },
          {
            name: {
              equals: name,
              mode: "insensitive",
            },
            city: {
              equals: city,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        googlePlaceId: true,
        name: true,
        city: true,
      },
    });

    const existingMatch = findExistingCafeForManualImport(existingCafes, {
      googlePlaceId,
      name,
      city,
    });

    if (existingMatch) {
      await prisma.cafe.update({
        where: { id: existingMatch.id },
        data: {
          googlePlaceId,
          name,
          address,
          city,
          latitude: manualCafe.latitude,
          longitude: manualCafe.longitude,
        },
      });
    } else {
      await prisma.cafe.create({
        data: {
          googlePlaceId,
          name,
          address,
          city,
          latitude: manualCafe.latitude,
          longitude: manualCafe.longitude,
        },
      });
    }

    importedCount += 1;
  }

  return importedCount;
}

async function main() {
  if (!googlePlacesApiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is required");
  }

  let totalImported = 0;
  let totalSkipped = 0;

  for (const target of citySearchTargets) {
    const result = await importForCity(target);
    totalImported += result.importedCount;
    totalSkipped += result.skippedCount;
    console.log(
      `[import-cafes] ${target.label}: upserted ${result.importedCount}, skipped ${result.skippedCount}, capped=${result.isLimitReached}`,
    );
  }

  const manualImported = await importManualCafes();
  totalImported += manualImported;

  console.log(`[import-cafes] manual: upserted ${manualImported} cafes`);
  console.log(`[import-cafes] done: upserted ${totalImported} cafes, skipped ${totalSkipped}`);
}

main()
  .catch((error) => {
    console.error("[import-cafes] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
