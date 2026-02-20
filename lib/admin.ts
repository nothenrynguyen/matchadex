import { getCurrentAuthUser } from "@/lib/auth";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isAdmin(userEmail: string | null | undefined) {
  if (!userEmail) {
    return false;
  }

  return getAdminEmails().includes(normalizeEmail(userEmail));
}

export async function isCurrentUserAdmin() {
  const authUser = await getCurrentAuthUser();
  return isAdmin(authUser?.email);
}

export const isAdminEmail = isAdmin;
