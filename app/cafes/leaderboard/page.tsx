import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function toAverage(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function ratingText(value: number | null) {
  return value === null ? "N/A" : value.toFixed(1);
}

export default async function LeaderboardPage() {
  const cafes = await prisma.cafe.findMany();
  const cafeIds = cafes.map((cafe) => cafe.id);

  const ratingGroups =
    cafeIds.length > 0
      ? await prisma.review.groupBy({
          by: ["cafeId"],
          where: { cafeId: { in: cafeIds } },
          _count: { _all: true },
          _avg: {
            tasteRating: true,
            aestheticRating: true,
            studyRating: true,
          },
        })
      : [];

  const ratingMap = new Map(
    ratingGroups.map((group) => [
      group.cafeId,
      {
        reviewCount: group._count._all,
        overallRating:
          group._avg.tasteRating === null ||
          group._avg.aestheticRating === null ||
          group._avg.studyRating === null
            ? null
            : toAverage(
                (group._avg.tasteRating +
                  group._avg.aestheticRating +
                  group._avg.studyRating) /
                  3,
              ),
      },
    ]),
  );

  const rankedCafes = cafes
    .map((cafe) => ({
      ...cafe,
      rating: ratingMap.get(cafe.id) ?? {
        reviewCount: 0,
        overallRating: null,
      },
    }))
    .filter((cafe) => cafe.rating.reviewCount > 0)
    .sort((leftCafe, rightCafe) => {
      if ((rightCafe.rating.overallRating ?? -1) !== (leftCafe.rating.overallRating ?? -1)) {
        return (rightCafe.rating.overallRating ?? -1) - (leftCafe.rating.overallRating ?? -1);
      }

      return rightCafe.rating.reviewCount - leftCafe.rating.reviewCount;
    })
    .slice(0, 20);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Top Cafes Leaderboard</h1>
        <Link href="/cafes" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Back to cafes
        </Link>
      </div>

      {rankedCafes.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
          Not enough reviews yet to build a leaderboard.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-zinc-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-zinc-500">Cafe</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-zinc-500">City</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-zinc-500">Overall</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-zinc-500">Reviews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rankedCafes.map((cafe, index) => (
                <tr key={cafe.id}>
                  <td className="px-4 py-3 text-sm text-zinc-700">#{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                    <Link href={`/cafes/${cafe.id}`} className="hover:underline">
                      {cafe.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">{cafe.city}</td>
                  <td className="px-4 py-3 text-sm text-zinc-700">{ratingText(cafe.rating.overallRating)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-700">{cafe.rating.reviewCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
