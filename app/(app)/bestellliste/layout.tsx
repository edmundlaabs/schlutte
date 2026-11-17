import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/auth/app-access";

/** Zugriff nur mit Freischaltung für die App „Bestellliste“ (Mitarbeiterverwaltung). */
export default async function BestelllisteLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("bestellliste");
  return <>{children}</>;
}
