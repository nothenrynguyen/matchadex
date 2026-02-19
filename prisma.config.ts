import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Use direct DB URL for CLI operations like migrate/validate.
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
});
