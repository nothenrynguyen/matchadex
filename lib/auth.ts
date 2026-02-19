import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type AuthLookupOptions = {
  createIfMissing?: boolean;
  userName?: string | null;
};

export async function getCurrentAuthUser() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function getCurrentPrismaUser(options: AuthLookupOptions = {}) {
  const authUser = await getCurrentAuthUser();

  if (!authUser?.email) {
    return null;
  }

  const normalizedEmail = authUser.email.trim().toLowerCase();

  if (options.createIfMissing) {
    return prisma.user.upsert({
      where: { email: normalizedEmail },
      update: options.userName ? { name: options.userName } : {},
      create: {
        email: normalizedEmail,
        name: options.userName ?? authUser.user_metadata?.full_name ?? null,
      },
    });
  }

  return prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
}
