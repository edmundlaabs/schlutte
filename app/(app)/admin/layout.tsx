import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { hasAdminRights } from "@/lib/auth/app-role";
import { getCurrentUserContext } from "@/lib/auth/roles";

/** Admin-Bereich (Mitarbeiter, Zugänge, Feedback): nur für CEO und Administratoren. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx || !hasAdminRights(ctx.role)) redirect("/");
  return <>{children}</>;
}
