import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/roles";
import { hasAdminRights } from "@/lib/auth/app-role";

/** Verwaltung: nur CEO und Admin (die Datenbank sichert zusätzlich per RLS ab). */
export default async function VerwaltungLayout({ children }: { children: ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login?next=/urlaub/verwaltung");
  if (!hasAdminRights(ctx.role)) redirect("/urlaub");
  return <>{children}</>;
}
