import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  BANNED_CAFE_WORDS,
  getMatchingBannedWord,
  inferCityLabelFromText,
  isCafeOrCoffeeType,
} from "./importCafes.helpers";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for import script");
}

const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!googlePlacesApiKey) {
  throw new Error("GOOGLE_PLACES_API_KEY is required for importByName");
}
const googlePlacesApiKeyValue = googlePlacesApiKey;

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

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
  results?: TextSearchResult[];
};

function parseCafeQueries() {
  const content = readFileSync("scripts/cafeList.txt", "utf8");

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isExplicitQueryForCafe(query: string, cafeName: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(cafeName);
  return normalizedQuery.includes(normalizedName) || normalizedName.includes(normalizedQuery);
}

async function fetchTextSearch(query: string) {
  const params = new URLSearchParams({
    query,
    key: googlePlacesApiKeyValue,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`,
    { method: "GET", cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Google Places text search failed with status ${response.status}`);
  }

  return (await response.json()) as TextSearchResponse;
}

async function importByQuery(query: string) {
  const payload = await fetchTextSearch(query);

  if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    throw new Error(payload.error_message ?? `Google Places text search returned ${payload.status}`);
  }

  const match = payload.results?.[0];
  if (!match) {
    console.log(`[import-by-name] skipped "${query}": no results`);
    return false;
  }

  const googlePlaceId = match.place_id?.trim();
  const name = match.name?.trim();
  const address = match.formatted_address?.trim() ?? null;
  const latitude = match.geometry?.location?.lat ?? null;
  const longitude = match.geometry?.location?.lng ?? null;
  const types = match.types ?? [];

  if (!googlePlaceId || !name || latitude === null || longitude === null) {
    console.log(`[import-by-name] skipped "${query}": missing required place fields`);
    return false;
  }

  const isExplicitlyListed = isExplicitQueryForCafe(query, name);
  const bannedWord = getMatchingBannedWord(name, address, BANNED_CAFE_WORDS);
  if (bannedWord && !isExplicitlyListed) {
    console.log(`[import-by-name] skipped "${query}": "${name}" matched banned word "${bannedWord}"`);
    return false;
  }

  if (!isCafeOrCoffeeType(types)) {
    console.log(`[import-by-name] skipped "${query}": "${name}" missing cafe/coffee type`);
    return false;
  }

  const city = inferCityLabelFromText(query, address);
  if (!city) {
    console.log(`[import-by-name] skipped "${query}": could not infer city label`);
    return false;
  }

  await prisma.cafe.upsert({
    where: { googlePlaceId },
    update: {
      name,
      address,
      city,
      latitude,
      longitude,
    },
    create: {
      googlePlaceId,
      name,
      address,
      city,
      latitude,
      longitude,
    },
  });

  console.log(`[import-by-name] upserted "${name}" (${city}) from "${query}"`);
  return true;
}

async function main() {
  const queries = parseCafeQueries();

  if (queries.length === 0) {
    console.log("[import-by-name] no queries found in scripts/cafeList.txt");
    return;
  }

  let importedCount = 0;
  let skippedCount = 0;

  for (const query of queries) {
    const imported = await importByQuery(query);
    if (imported) {
      importedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  console.log(`[import-by-name] done: upserted ${importedCount}, skipped ${skippedCount}`);
}

main()
  .catch((error) => {
    console.error("[import-by-name] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
