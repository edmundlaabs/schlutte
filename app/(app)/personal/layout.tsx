import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/auth/app-access";

/** Zugriff nur mit Freischaltung für die App „Druckvorlagen Büro/Personal“ (Mitarbeiterverwaltung). */
export default async function PersonalLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("personal");
  return <>{children}</>;
}
