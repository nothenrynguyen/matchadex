import { notFound } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import AdminCafePanel from "./AdminCafePanel";

export default async function AdminPage() {
  const authUser = await getCurrentAuthUser();

  if (!isAdmin(authUser?.email)) {
    notFound();
  }

  return <AdminCafePanel />;
}
