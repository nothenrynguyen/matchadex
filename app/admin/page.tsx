import { notFound } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import AdminCafePanel from "./AdminCafePanel";

export default async function AdminPage() {
  const authUser = await getCurrentAuthUser();

  if (!isAdminEmail(authUser?.email)) {
    notFound();
  }

  return <AdminCafePanel />;
}
