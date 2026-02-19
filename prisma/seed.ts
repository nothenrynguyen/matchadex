import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// create postgres adapter with DATABASE_URL
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// create Prisma client using postgres adapter
const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // define 10 cafes across requested cities
  const cafes = [
    {
      name: "Midori Matcha House",
      city: "LA",
      address: "742 Spring St, Los Angeles, CA",
      googlePlaceId: "mdx-la-001",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    },
    {
      name: "Kumo Tea Lab",
      city: "LA",
      address: "1190 Sunset Blvd, Los Angeles, CA",
      googlePlaceId: "mdx-la-002",
      createdAt: new Date("2026-01-01T10:05:00.000Z"),
    },
    {
      name: "Sora Matcha Bar",
      city: "OC",
      address: "331 Harbor Blvd, Costa Mesa, CA",
      googlePlaceId: "mdx-oc-001",
      createdAt: new Date("2026-01-01T10:10:00.000Z"),
    },
    {
      name: "Foam & Whisk",
      city: "OC",
      address: "8002 Westminster Ave, Westminster, CA",
      googlePlaceId: "mdx-oc-002",
      createdAt: new Date("2026-01-01T10:15:00.000Z"),
    },
    {
      name: "Uji Social Club",
      city: "Bay Area",
      address: "522 Valencia St, San Francisco, CA",
      googlePlaceId: "mdx-bay-001",
      createdAt: new Date("2026-01-01T10:20:00.000Z"),
    },
    {
      name: "Ceremony Cafe",
      city: "Bay Area",
      address: "211 University Ave, Palo Alto, CA",
      googlePlaceId: "mdx-bay-002",
      createdAt: new Date("2026-01-01T10:25:00.000Z"),
    },
    {
      name: "Cloud Whisk Cafe",
      city: "Seattle",
      address: "910 Pine St, Seattle, WA",
      googlePlaceId: "mdx-sea-001",
      createdAt: new Date("2026-01-01T10:30:00.000Z"),
    },
    {
      name: "Ame Matcha Kitchen",
      city: "Seattle",
      address: "401 Broadway E, Seattle, WA",
      googlePlaceId: "mdx-sea-002",
      createdAt: new Date("2026-01-01T10:35:00.000Z"),
    },
    {
      name: "Moss & Milk",
      city: "NYC",
      address: "137 Mulberry St, New York, NY",
      googlePlaceId: "mdx-nyc-001",
      createdAt: new Date("2026-01-01T10:40:00.000Z"),
    },
    {
      name: "Whisk District",
      city: "NYC",
      address: "254 W 14th St, New York, NY",
      googlePlaceId: "mdx-nyc-002",
      createdAt: new Date("2026-01-01T10:45:00.000Z"),
    },
  ];

  // upsert each cafe by googlePlaceId to avoid duplicates on rerun
  for (const cafe of cafes) {
    await prisma.cafe.upsert({
      where: { googlePlaceId: cafe.googlePlaceId },
      update: {
        name: cafe.name,
        city: cafe.city,
        address: cafe.address,
      },
      create: cafe,
    });
  }
}

// run seed script and close DB connection
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
