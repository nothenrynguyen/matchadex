import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { importCafeByQuery } from "@/lib/cafes/importByQuery";

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

function parseCafeQueries() {
  const content = readFileSync("scripts/cafeList.txt", "utf8");

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function importByQuery(query: string) {
  const result = await importCafeByQuery({
    prisma,
    googlePlacesApiKey: googlePlacesApiKeyValue,
    query,
  });

  if (!result.imported) {
    console.log(`[import-by-name] skipped "${query}": no results`);
    return false;
  }
  console.log(`[import-by-name] upserted "${result.cafeName}" from "${query}"`);
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
