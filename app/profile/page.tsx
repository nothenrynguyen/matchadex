import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import AdminModeToggle from "./AdminModeToggle";

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
        tasteRating: true,
        aestheticRating: true,
        studyRating: true,
        textComment: true,
        updatedAt: true,
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

  const reviewedCafes = Array.from(
    new Map(
      reviews.map((review) => [
        review.cafe.id,
        {
          id: review.cafe.id,
          name: review.cafe.name,
          city: review.cafe.city,
        },
      ]),
    ).values(),
  );
  const displayName = (currentUser.name || currentUser.email).toLowerCase();
  const canUseAdminMode = isAdmin(currentUser.email);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 overflow-auto">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{displayName}</h1>
        <p className="mt-4 text-sm text-zinc-700">
          {reviews.length} reviews written
        </p>
      </section>

      {canUseAdminMode ? <AdminModeToggle /> : null}

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

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Your reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No reviews yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/cafes/${review.cafe.id}`} className="text-sm font-medium text-zinc-900 hover:underline">
                    {review.cafe.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{new Date(review.updatedAt).toLocaleDateString()}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{review.cafe.city}</p>
                <div className="mt-2 grid gap-1 text-sm text-zinc-700 sm:grid-cols-3">
                  <p>Taste: {review.tasteRating}</p>
                  <p>Aesthetic: {review.aestheticRating}</p>
                  <p>Study: {review.studyRating}</p>
                </div>
                {review.textComment ? (
                  <p className="mt-2 text-sm text-zinc-700">{review.textComment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
