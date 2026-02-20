import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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
};

type NearbySearchResponse = {
  results?: NearbySearchResult[];
  next_page_token?: string;
  status?: string;
  error_message?: string;
};

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

      if (!googlePlaceId || !name || latitude === null || longitude === null) {
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
    }

    pageToken = payload.next_page_token;
    pagesFetched += 1;
  } while (pageToken && pagesFetched < 3);

  return importedCount;
}

async function main() {
  if (!googlePlacesApiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is required");
  }

  let totalImported = 0;

  for (const target of citySearchTargets) {
    const importedCount = await importForCity(target);
    totalImported += importedCount;
    console.log(`[import-cafes] ${target.label}: upserted ${importedCount} cafes`);
  }

  console.log(`[import-cafes] done: upserted ${totalImported} cafes`);
}

main()
  .catch((error) => {
    console.error("[import-cafes] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
