import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// create postgres adapter with direct URL fallback for reliable seed writes
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});

// create Prisma client using postgres adapter
const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // define 10 real cafes across requested cities
  const cafes = [
    {
      name: "Maru Coffee",
      city: "LA",
      address: "1019 S Santa Fe Ave, Los Angeles, CA 90021",
      googlePlaceId: "real-la-maru-coffee",
      latitude: 34.032754,
      longitude: -118.230909,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    },
    {
      name: "Cafe Dulce",
      city: "LA",
      address: "134 Japanese Village Plaza Mall, Los Angeles, CA 90012",
      googlePlaceId: "real-la-cafe-dulce-lt",
      latitude: 34.049806,
      longitude: -118.24016,
      createdAt: new Date("2026-01-01T10:05:00.000Z"),
    },
    {
      name: "OMOMO Tea Shoppe",
      city: "OC",
      address: "2710 Alton Pkwy Ste 209, Irvine, CA 92606",
      googlePlaceId: "real-oc-omomo-irvine",
      latitude: 33.688441,
      longitude: -117.826145,
      createdAt: new Date("2026-01-01T10:10:00.000Z"),
    },
    {
      name: "Orobae",
      city: "OC",
      address: "2700 Alton Pkwy #133, Irvine, CA 92606",
      googlePlaceId: "real-oc-orobae-irvine",
      latitude: 33.689024,
      longitude: -117.829573,
      createdAt: new Date("2026-01-01T10:15:00.000Z"),
    },
    {
      name: "Stonemill Matcha",
      city: "Bay Area",
      address: "561 Valencia St, San Francisco, CA 94110",
      googlePlaceId: "real-bay-stonemill-sf",
      latitude: 37.76401,
      longitude: -122.42106,
      createdAt: new Date("2026-01-01T10:20:00.000Z"),
    },
    {
      name: "Asha Tea House",
      city: "Bay Area",
      address: "17 Kearny St, San Francisco, CA 94108",
      googlePlaceId: "real-bay-asha-sf",
      latitude: 37.788264,
      longitude: -122.403893,
      createdAt: new Date("2026-01-01T10:25:00.000Z"),
    },
    {
      name: "Miro Tea",
      city: "Seattle",
      address: "5405 Ballard Ave NW, Seattle, WA 98107",
      googlePlaceId: "real-sea-miro-tea",
      latitude: 47.668159,
      longitude: -122.384468,
      createdAt: new Date("2026-01-01T10:30:00.000Z"),
    },
    {
      name: "Anchorhead Coffee",
      city: "Seattle",
      address: "1600 7th Ave, Seattle, WA 98101",
      googlePlaceId: "real-sea-anchorhead-downtown",
      latitude: 47.613092,
      longitude: -122.335197,
      createdAt: new Date("2026-01-01T10:35:00.000Z"),
    },
    {
      name: "Kettl",
      city: "NYC",
      address: "70 Greenpoint Ave, Brooklyn, NY 11222",
      googlePlaceId: "real-nyc-kettl-greenpoint",
      latitude: 40.729653,
      longitude: -73.958152,
      createdAt: new Date("2026-01-01T10:40:00.000Z"),
    },
    {
      name: "Matchaful",
      city: "NYC",
      address: "184 Kent Ave, Brooklyn, NY 11249",
      googlePlaceId: "real-nyc-matchaful-williamsburg",
      latitude: 40.718176,
      longitude: -73.96814,
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
        latitude: cafe.latitude,
        longitude: cafe.longitude,
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
