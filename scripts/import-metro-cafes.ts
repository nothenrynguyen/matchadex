import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { fetchTextSearchPage } from "@/lib/cafes/importByQuery";
import { BANNED_CAFE_WORDS, getMatchingBannedWord, isCafeOrCoffeeType } from "./importCafes.helpers";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for import script");
}

const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!googlePlacesApiKey) {
  throw new Error("GOOGLE_PLACES_API_KEY is required for metro import");
}
const googlePlacesApiKeyValue = googlePlacesApiKey;

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

type Metro = "Bay" | "NYC";

const METRO_QUERY_NAMES: Record<Metro, string> = {
  Bay: "Bay Area",
  NYC: "NYC",
};

function parseMetroArg(value: string | undefined): Metro {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "bay") {
    return "Bay";
  }

  if (normalized === "nyc") {
    return "NYC";
  }

  throw new Error('Metro argument is required and must be "Bay" or "NYC"');
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const metro = parseMetroArg(process.argv[2]);
  const queryName = METRO_QUERY_NAMES[metro];
  const baseQuery = `matcha cafe in ${queryName}`;

  const existingPlaceIds = new Set(
    (
      await prisma.cafe.findMany({
        select: {
          googlePlaceId: true,
        },
      })
    ).map((cafe) => cafe.googlePlaceId),
  );

  const importedPlaceIds = new Set<string>();
  let nextPageToken: string | undefined;
  let page = 1;

  console.log(`[import-metro-cafes] importing up to 100 cafes for ${metro} using query "${baseQuery}"`);

  while (importedPlaceIds.size < 100 && page <= 3) {
    if (nextPageToken) {
      // Google Places requires a short wait before pagetoken becomes valid.
      await wait(1800);
    }

    const payload = await fetchTextSearchPage(googlePlacesApiKeyValue, baseQuery, nextPageToken);
    const results = payload.results ?? [];

    for (const place of results) {
      if (importedPlaceIds.size >= 100) {
        break;
      }

      const googlePlaceId = place.place_id?.trim();
      const name = place.name?.trim();
      const address = place.formatted_address?.trim() ?? null;
      const latitude = place.geometry?.location?.lat ?? null;
      const longitude = place.geometry?.location?.lng ?? null;
      const types = place.types ?? [];

      if (!googlePlaceId || !name || latitude === null || longitude === null) {
        continue;
      }

      if (existingPlaceIds.has(googlePlaceId) || importedPlaceIds.has(googlePlaceId)) {
        continue;
      }

      const bannedWord = getMatchingBannedWord(name, address, BANNED_CAFE_WORDS);
      if (bannedWord) {
        continue;
      }

      if (!isCafeOrCoffeeType(types)) {
        continue;
      }

      await prisma.cafe.create({
        data: {
          googlePlaceId,
          name,
          address,
          city: metro,
          latitude,
          longitude,
        },
      });

      importedPlaceIds.add(googlePlaceId);
      console.log(`[import-metro-cafes] imported ${importedPlaceIds.size}/100: ${name}`);
    }

    if (!payload.next_page_token) {
      break;
    }

    nextPageToken = payload.next_page_token;
    page += 1;
  }

  console.log(`[import-metro-cafes] done for ${metro}: imported ${importedPlaceIds.size} cafes`);
}

main()
  .catch((error) => {
    console.error("[import-metro-cafes] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
