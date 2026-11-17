import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/auth/app-access";
import "./gerda.css";

export const dynamic = "force-dynamic";

/** Gerda: Zugriff nur mit Freischaltung „Gerda“ (Mitarbeiter → Zugänge). Daten zusätzlich per RLS geschützt. */
export default async function GerdaLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("gerda");
  return <>{children}</>;
}
