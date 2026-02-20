import { getCurrentAuthUser } from "@/lib/auth";

const DEFAULT_ADMIN_EMAILS = ["nothenrynguyen@gmail.com"];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAdminEmails() {
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  if (configuredEmails.length > 0) {
    return configuredEmails;
  }

  return DEFAULT_ADMIN_EMAILS;
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
