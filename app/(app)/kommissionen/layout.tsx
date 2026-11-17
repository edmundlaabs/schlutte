import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/auth/app-access";

/** Zugriff nur mit Freischaltung für die App „Druckvorlagen Werkstatt“ (Mitarbeiterverwaltung). */
export default async function KommissionenLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("werkstatt");
  return <>{children}</>;
}
