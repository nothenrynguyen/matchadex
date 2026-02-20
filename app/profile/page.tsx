import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const currentUser = await getCurrentPrismaUser();

  if (!currentUser) {
    redirect("/auth");
  }

  const [reviews, favorites] = await Promise.all([
    prisma.review.findMany({
      where: { userId: currentUser.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        cafe: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    }),
    prisma.favorite.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        cafe: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    }),
  ]);

  const reviewedCafeMap = new Map<string, { id: string; name: string; city: string }>();

  for (const review of reviews) {
    reviewedCafeMap.set(review.cafe.id, review.cafe);
  }

  const reviewedCafes = Array.from(reviewedCafeMap.values());
  const displayName = (currentUser.name || currentUser.email).toLowerCase();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{displayName}</h1>
        <p className="mt-1 text-sm text-zinc-600">{currentUser.email}</p>
        <p className="mt-4 text-sm text-zinc-700">
          {reviews.length} reviews written
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Cafes reviewed</h2>
        {reviewedCafes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No cafes reviewed yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {reviewedCafes.map((cafe) => (
              <li key={cafe.id} className="rounded-lg border border-zinc-200 p-3">
                <Link href={`/cafes/${cafe.id}`} className="text-sm font-medium text-zinc-900 hover:underline">
                  {cafe.name}
                </Link>
                <p className="text-xs text-zinc-500">{cafe.city}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Favorite cafes</h2>
        {favorites.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No favorites yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {favorites.map((favorite) => (
              <li key={favorite.id} className="rounded-lg border border-zinc-200 p-3">
                <Link href={`/cafes/${favorite.cafe.id}`} className="text-sm font-medium text-zinc-900 hover:underline">
                  {favorite.cafe.name}
                </Link>
                <p className="text-xs text-zinc-500">{favorite.cafe.city}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
