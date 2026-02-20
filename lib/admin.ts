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

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(normalizeEmail(email));
}

export async function isCurrentUserAdmin() {
  const authUser = await getCurrentAuthUser();
  return isAdminEmail(authUser?.email);
}
